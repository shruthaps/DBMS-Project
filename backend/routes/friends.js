const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();


router.get('/users', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;

    const [users] = await db.query(
      `SELECT
         u.user_id,
         u.name,
         u.total_points,
         u.current_streak,
         l.name AS level_name,
         -- friendship status from MY perspective
         CASE
           WHEN f1.status IS NOT NULL THEN f1.status   -- I sent the request
           WHEN f2.status IS NOT NULL THEN f2.status   -- They sent the request
           ELSE NULL
         END AS friendship_status,
         CASE
           WHEN f1.friendship_id IS NOT NULL THEN f1.friendship_id
           WHEN f2.friendship_id IS NOT NULL THEN f2.friendship_id
           ELSE NULL
         END AS friendship_id,
         -- who sent the request (so frontend knows if it can accept)
         CASE
           WHEN f1.friendship_id IS NOT NULL THEN 'me'
           WHEN f2.friendship_id IS NOT NULL THEN 'them'
           ELSE NULL
         END AS request_direction
       FROM USER u
       LEFT JOIN LEVEL l ON u.level_id = l.level_id
       LEFT JOIN FRIENDSHIP f1 ON f1.requester_id = ? AND f1.addressee_id = u.user_id
       LEFT JOIN FRIENDSHIP f2 ON f2.requester_id = u.user_id AND f2.addressee_id = ?
       WHERE u.user_id != ?
       ORDER BY u.name ASC`,
      [me, me, me]
    );

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/friends
//  Returns the logged-in user's accepted friends.
// ─────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;

    const [friends] = await db.query(
      `SELECT
         u.user_id,
         u.name,
         u.total_points,
         u.current_streak,
         l.name AS level_name,
         f.friendship_id
       FROM FRIENDSHIP f
       JOIN USER u ON (
         CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END = u.user_id
       )
       LEFT JOIN LEVEL l ON u.level_id = l.level_id
       WHERE (f.requester_id = ? OR f.addressee_id = ?)
         AND f.status = 'ACCEPTED'
       ORDER BY u.name ASC`,
      [me, me, me]
    );

    res.json({ friends });
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/friends/requests
//  Returns pending friend requests sent TO me.
// ─────────────────────────────────────────────
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;

    const [requests] = await db.query(
      `SELECT
         f.friendship_id,
         u.user_id,
         u.name,
         u.total_points,
         l.name AS level_name,
         f.created_at
       FROM FRIENDSHIP f
       JOIN USER u ON f.requester_id = u.user_id
       LEFT JOIN LEVEL l ON u.level_id = l.level_id
       WHERE f.addressee_id = ? AND f.status = 'PENDING'
       ORDER BY f.created_at DESC`,
      [me]
    );

    res.json({ requests });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/friends/request/:userId
//  Send a friend request to another user.
// ─────────────────────────────────────────────
router.post('/request/:userId', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const them = parseInt(req.params.userId);

    if (me === them) {
      return res.status(400).json({ message: "You can't add yourself." });
    }

    // Check if a friendship row already exists in either direction
    const [[existing]] = await db.query(
      `SELECT friendship_id, status FROM FRIENDSHIP
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)`,
      [me, them, them, me]
    );

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return res.status(409).json({ message: 'Already friends!' });
      }
      if (existing.status === 'PENDING') {
        return res.status(409).json({ message: 'Friend request already pending.' });
      }
      // If DECLINED, let them try again — update back to PENDING
      await db.query(
        `UPDATE FRIENDSHIP SET status = 'PENDING', requester_id = ?, addressee_id = ?
         WHERE friendship_id = ?`,
        [me, them, existing.friendship_id]
      );
      return res.json({ message: 'Friend request sent!' });
    }

    await db.query(
      'INSERT INTO FRIENDSHIP (requester_id, addressee_id, status) VALUES (?, ?, "PENDING")',
      [me, them]
    );

    res.status(201).json({ message: 'Friend request sent!' });
  } catch (err) {
    console.error('Send request error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/friends/accept/:friendshipId
//  Accept a pending friend request.
// ─────────────────────────────────────────────
router.post('/accept/:friendshipId', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const fid = req.params.friendshipId;

    const [[row]] = await db.query(
      'SELECT * FROM FRIENDSHIP WHERE friendship_id = ? AND addressee_id = ? AND status = "PENDING"',
      [fid, me]
    );

    if (!row) {
      return res.status(404).json({ message: 'Request not found or not yours to accept.' });
    }

    await db.query(
      'UPDATE FRIENDSHIP SET status = "ACCEPTED" WHERE friendship_id = ?',
      [fid]
    );

    res.json({ message: 'Friend request accepted!' });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/friends/decline/:friendshipId
//  Decline a pending friend request.
// ─────────────────────────────────────────────
router.post('/decline/:friendshipId', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const fid = req.params.friendshipId;

    await db.query(
      'UPDATE FRIENDSHIP SET status = "DECLINED" WHERE friendship_id = ? AND addressee_id = ?',
      [fid, me]
    );

    res.json({ message: 'Request declined.' });
  } catch (err) {
    console.error('Decline request error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
