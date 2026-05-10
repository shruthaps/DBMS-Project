const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ─────────────────────────────────────────────
//  GET /api/challenges
//  Browse all available challenges (SOLO + GROUP).
//  Includes whether the authenticated user has already joined each one.
// ─────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [challenges] = await db.query(
      `SELECT
         c.*,
         uc.status         AS my_status,
         uc.days_completed AS my_days_completed,
         uc.joined_at      AS my_joined_at
       FROM CHALLENGE c
       LEFT JOIN USER_CHALLENGE uc
         ON uc.challenge_id = c.challenge_id AND uc.user_id = ?
       ORDER BY c.start_date DESC`,
      [userId]
    );

    res.json({ challenges });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/challenges/mine
//  Returns all challenges the authenticated user is currently enrolled in.
// ─────────────────────────────────────────────
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [active] = await db.query(
      `SELECT
         uc.uc_id,
         uc.days_completed,
         uc.status,
         uc.bonus_awarded,
         uc.joined_at,
         c.challenge_id,
         c.title,
         c.description,
         c.type,
         c.target_days,
         c.target_limit_min,
         c.bonus_points,
         c.start_date,
         c.end_date
       FROM USER_CHALLENGE uc
       JOIN CHALLENGE c ON uc.challenge_id = c.challenge_id
       WHERE uc.user_id = ?
       ORDER BY uc.joined_at DESC`,
      [userId]
    );

    res.json({ challenges: active });
  } catch (error) {
    console.error('Get my challenges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/challenges/:id/join
//  Join an existing SOLO or GROUP challenge.
//  Cannot join a challenge already joined or already ended.
// ─────────────────────────────────────────────
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const userId      = req.user.id;
    const challengeId = req.params.id;

    // Verify the challenge exists
    const [[challenge]] = await db.query(
      'SELECT * FROM CHALLENGE WHERE challenge_id = ?',
      [challengeId]
    );

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found.' });
    }

    // Check the challenge hasn't ended already
    if (challenge.end_date && new Date(challenge.end_date) < new Date()) {
      return res.status(400).json({ message: 'This challenge has already ended.' });
    }

    // Check the user hasn't already joined
    const [[existing]] = await db.query(
      'SELECT uc_id FROM USER_CHALLENGE WHERE user_id = ? AND challenge_id = ?',
      [userId, challengeId]
    );

    if (existing) {
      return res.status(409).json({ message: 'You have already joined this challenge.' });
    }

    const [result] = await db.query(
      `INSERT INTO USER_CHALLENGE (user_id, challenge_id, days_completed, status)
       VALUES (?, ?, 0, 'IN_PROGRESS')`,
      [userId, challengeId]
    );

    res.status(201).json({
      message: 'Successfully joined the challenge!',
      uc_id: result.insertId,
      challenge_id: parseInt(challengeId),
      title: challenge.title,
      type: challenge.type,
      target_days: challenge.target_days,
      bonus_points: challenge.bonus_points,
    });
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/challenges/group
//  Create a new GROUP challenge.
//  Body: { title, description, target_days, target_limit_min, bonus_points,
//          start_date, end_date, group_name, target_members, group_bonus_points }
//
//  Flow:
//    1. Insert into CHALLENGE (type = GROUP)
//    2. Insert into GROUP_CHALLENGE
//    3. Auto-join the creator into USER_CHALLENGE
// ─────────────────────────────────────────────
router.post('/group', authMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const {
      title,
      description,
      target_days,
      target_limit_min,
      bonus_points = 0,
      start_date,
      end_date,
      group_name,
      target_members = 2,
      group_bonus_points = 0,
    } = req.body;

    if (!title || !target_days || target_limit_min === undefined || !group_name) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        message: 'title, target_days, target_limit_min, and group_name are required.',
      });
    }

    // 1. Insert the base CHALLENGE row
    const [challengeResult] = await conn.query(
      `INSERT INTO CHALLENGE
         (title, description, type, target_days, target_limit_min, bonus_points, start_date, end_date)
       VALUES (?, ?, 'GROUP', ?, ?, ?, ?, ?)`,
      [title, description || null, target_days, target_limit_min, bonus_points,
       start_date || null, end_date || null]
    );
    const challengeId = challengeResult.insertId;

    // 2. Insert into GROUP_CHALLENGE
    const [gcResult] = await conn.query(
      `INSERT INTO GROUP_CHALLENGE
         (challenge_id, created_by, group_name, target_members, group_bonus_points)
       VALUES (?, ?, ?, ?, ?)`,
      [challengeId, userId, group_name, target_members, group_bonus_points]
    );

    // 3. Auto-join creator
    await conn.query(
      `INSERT INTO USER_CHALLENGE (user_id, challenge_id, days_completed, status)
       VALUES (?, ?, 0, 'IN_PROGRESS')`,
      [userId, challengeId]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Group challenge created! Share the challenge ID with friends.',
      challenge_id: challengeId,
      gc_id: gcResult.insertId,
      title,
      group_name,
      target_members,
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Create group challenge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
