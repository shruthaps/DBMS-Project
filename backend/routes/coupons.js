const express = require('express');
const crypto  = require('crypto');
const db      = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ── Utility: generate a unique, uppercase redemption code ────────────────
const generateCode = (brandName) => {
  const prefix = brandName.replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const rand   = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${rand}`;
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId   = req.user.id;
    const category = req.query.category;
    const showAll  = req.query.all === 'true';

    // Fetch user's current level_id
    const [[user]] = await db.query(
      'SELECT level_id FROM USER WHERE user_id = ?',
      [userId]
    );

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Build query — only show coupons at or below the user's level
    // and that still have stock remaining and haven't expired
    let sql = `
      SELECT
        c.*,
        l.name AS min_level_name
      FROM COUPON c
      JOIN LEVEL l ON c.min_level_id = l.level_id
      WHERE c.redeemed_count < c.total_stock
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
    `;

    const params = [];

    if (!showAll) {
      sql += ' AND c.min_level_id <= ?';
      params.push(user.level_id);
    }

    if (category) {
      sql += ' AND c.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY c.points_required ASC';

    const [coupons] = await db.query(sql, params);

    res.json({
      user_level_id: user.level_id,
      count: coupons.length,
      coupons,
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/coupons/:id/redeem
//  Redeem a coupon.
//  Business rules:
//    - User's level must meet the minimum
//    - User must have enough points
//    - Coupon must have stock remaining and not be expired
//    - User cannot redeem the same coupon twice
// ─────────────────────────────────────────────
router.post('/:id/redeem', authMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId   = req.user.id;
    const couponId = req.params.id;

    // Lock the coupon row to prevent race conditions
    const [[coupon]] = await conn.query(
      'SELECT * FROM COUPON WHERE coupon_id = ? FOR UPDATE',
      [couponId]
    );

    if (!coupon) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Coupon not found.' });
    }

    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'This coupon has expired.' });
    }

    // Check stock
    if (coupon.redeemed_count >= coupon.total_stock) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'This coupon is out of stock.' });
    }

    // Fetch user (lock row)
    const [[user]] = await conn.query(
      'SELECT user_id, total_points, level_id FROM USER WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    // Check level eligibility
    if (user.level_id < coupon.min_level_id) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        message: 'Your current level is not high enough to redeem this coupon.',
      });
    }

    // Check sufficient points
    if (user.total_points < coupon.points_required) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        message: `You need ${coupon.points_required} points but only have ${user.total_points}.`,
      });
    }

    // Check if already redeemed by this user
    const [[alreadyRedeemed]] = await conn.query(
      'SELECT uc_id FROM USER_COUPON WHERE user_id = ? AND coupon_id = ?',
      [userId, couponId]
    );

    if (alreadyRedeemed) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ message: 'You have already redeemed this coupon.' });
    }

    // Generate unique redemption code (retry on collision)
    let code;
    let attempts = 0;
    do {
      code = generateCode(coupon.brand_name);
      const [[collision]] = await conn.query(
        'SELECT uc_id FROM USER_COUPON WHERE redemption_code = ?',
        [code]
      );
      if (!collision) break;
      attempts++;
    } while (attempts < 5);

    // Deduct points from USER
    await conn.query(
      'UPDATE USER SET total_points = total_points - ? WHERE user_id = ?',
      [coupon.points_required, userId]
    );

    // Increment redeemed_count on COUPON
    await conn.query(
      'UPDATE COUPON SET redeemed_count = redeemed_count + 1 WHERE coupon_id = ?',
      [couponId]
    );

    // Insert USER_COUPON row
    const [ucResult] = await conn.query(
      `INSERT INTO USER_COUPON (user_id, coupon_id, redemption_code)
       VALUES (?, ?, ?)`,
      [userId, couponId, code]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: `🎉 Coupon redeemed! Save your code.`,
      redemption: {
        uc_id:            ucResult.insertId,
        coupon_id:        coupon.coupon_id,
        brand_name:       coupon.brand_name,
        discount_value:   coupon.discount_value,
        redemption_code:  code,
        points_spent:     coupon.points_required,
        points_remaining: user.total_points - coupon.points_required,
      },
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Redeem coupon error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/coupons/mine
//  Returns all coupons redeemed by the authenticated user.
// ─────────────────────────────────────────────
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [redeemed] = await db.query(
      `SELECT
         uc.uc_id,
         uc.redemption_code,
         uc.redeemed_at,
         uc.is_used,
         uc.used_at,
         c.coupon_id,
         c.brand_name,
         c.category,
         c.discount_value,
         c.points_required,
         c.expiry_date
       FROM USER_COUPON uc
       JOIN COUPON c ON uc.coupon_id = c.coupon_id
       WHERE uc.user_id = ?
       ORDER BY uc.redeemed_at DESC`,
      [userId]
    );

    res.json({ count: redeemed.length, coupons: redeemed });
  } catch (error) {
    console.error('Get my coupons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
