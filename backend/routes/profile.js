const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[profile]] = await db.query(
      `SELECT
         u.user_id,
         u.name,
         u.email,
         u.total_points,
         u.current_streak,
         u.longest_streak,
         u.shields_available,
         l.level_id,
         l.name             AS level_name,
         l.min_points       AS level_min_points,
         l.max_points       AS level_max_points,
         l.coupon_discount_pct,
         l.badge_icon
       FROM USER u
       JOIN LEVEL l ON u.level_id = l.level_id
       WHERE u.user_id = ?`,
      [userId]
    );

    if (!profile) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Calculate progress toward the next level
    const [levels] = await db.query(
      'SELECT * FROM LEVEL ORDER BY min_points ASC'
    );

    const currentLevelIndex = levels.findIndex(l => l.level_id === profile.level_id);
    const nextLevel         = levels[currentLevelIndex + 1] || null;

    let progressPct = 100; // Already at max level
    let pointsToNextLevel = 0;

    if (nextLevel) {
      const pointsInCurrentBand = nextLevel.min_points - profile.level_min_points;
      const pointsEarned        = profile.total_points - profile.level_min_points;
      progressPct               = Math.min(100, Math.round((pointsEarned / pointsInCurrentBand) * 100));
      pointsToNextLevel         = nextLevel.min_points - profile.total_points;
    }

    res.json({
      profile: {
        user_id:           profile.user_id,
        name:              profile.name,
        email:             profile.email,
        total_points:      profile.total_points,
        current_streak:    profile.current_streak,
        longest_streak:    profile.longest_streak,
        shields_available: profile.shields_available,
        level: {
          level_id:           profile.level_id,
          name:               profile.level_name,
          badge_icon:         profile.badge_icon,
          coupon_discount_pct: profile.coupon_discount_pct,
          min_points:         profile.level_min_points,
          max_points:         profile.level_max_points,
        },
        next_level: nextLevel
          ? {
              level_id:   nextLevel.level_id,
              name:       nextLevel.name,
              min_points: nextLevel.min_points,
            }
          : null,
        level_progress_pct:   progressPct,
        points_to_next_level: Math.max(0, pointsToNextLevel),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
