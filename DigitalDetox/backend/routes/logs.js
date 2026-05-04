const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();


router.post('/submit', authMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const { date, logs } = req.body;


    if (!date || !Array.isArray(logs) || logs.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        message: 'date (YYYY-MM-DD) and a non-empty logs array are required.'
      });
    }

    const [existingLogs] = await conn.query(
      'SELECT log_id FROM SCREEN_LOG WHERE user_id = ? AND log_date = ? LIMIT 1',
      [userId, date]
    );
    if (existingLogs.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        message: `Screen time for ${date} has already been submitted.`
      });
    }

    // Fetch current user data
    const [[user]] = await conn.query(
      'SELECT total_points, current_streak, longest_streak, shields_available, level_id FROM USER WHERE user_id = ?',
      [userId]
    );

    let pointsEarned = 0;
    let allPassed = true;
    const logResults = [];

    // ── Step 1: Evaluate each app ──────────────────────────────────────
    for (const entry of logs) {
      const { limit_id, actual_usage_min } = entry;

      if (limit_id === undefined || actual_usage_min === undefined) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          message: 'Each log entry must have limit_id and actual_usage_min.'
        });
      }

      // Verify this limit belongs to the user
      const [[limit]] = await conn.query(
        'SELECT limit_id, daily_limit_min, app_name FROM APP_LIMIT WHERE limit_id = ? AND user_id = ? AND is_active = TRUE',
        [limit_id, userId]
      );

      if (!limit) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({
          message: `Active limit (id=${limit_id}) not found for this user.`
        });
      }

      const limitBreached = actual_usage_min > limit.daily_limit_min;
      const appPoints = limitBreached ? 0 : 10;

      if (limitBreached) allPassed = false;
      pointsEarned += appPoints;

      // Insert SCREEN_LOG row (shield_used updated later if needed)
      await conn.query(
        `INSERT INTO SCREEN_LOG (user_id, limit_id, log_date, actual_usage_min, limit_breached, points_earned, shield_used)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [userId, limit_id, date, actual_usage_min, limitBreached, appPoints]
      );

      logResults.push({
        limit_id,
        app_name: limit.app_name,
        actual_usage_min,
        daily_limit_min: limit.daily_limit_min,
        limit_breached: limitBreached,
        points_earned: appPoints
      });
    }

    // ── Step 2: Streak logic ───────────────────────────────────────────
    let newStreak = user.current_streak;
    let shieldUsed = false;
    let streakBroken = false;

    if (allPassed) {
      newStreak = user.current_streak + 1;
    } else if (user.shields_available > 0) {
      // Shield absorbs the failure — streak survives
      shieldUsed = true;
      newStreak = user.current_streak; // unchanged

      // Deduct one shield from USER
      await conn.query(
        'UPDATE USER SET shields_available = shields_available - 1 WHERE user_id = ?',
        [userId]
      );

      // Flag shield_used on the logs where limit was breached
      await conn.query(
        `UPDATE SCREEN_LOG SET shield_used = TRUE
         WHERE user_id = ? AND log_date = ? AND limit_breached = TRUE`,
        [userId, date]
      );
    } else {
      // No shield — streak breaks
      streakBroken = true;
      newStreak = 0;
    }

    const newLongest = Math.max(newStreak, user.longest_streak);

    // Upsert STREAK table (one row per active streak run, kept simple here)
    const [[streakRow]] = await conn.query(
      'SELECT streak_id FROM STREAK WHERE user_id = ? AND is_active = TRUE LIMIT 1',
      [userId]
    );

    if (streakRow) {
      await conn.query(
        `UPDATE STREAK
         SET current_count = ?, longest_count = ?, last_active_date = ?, is_active = ?
         WHERE streak_id = ?`,
        [newStreak, newLongest, date, newStreak > 0 ? true : false, streakRow.streak_id]
      );
    } else {
      await conn.query(
        `INSERT INTO STREAK (user_id, start_date, current_count, longest_count, last_active_date, is_active)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [userId, date, newStreak, newLongest, date]
      );
    }

    // ── Step 3: Points + Level-up ──────────────────────────────────────
    const newTotalPoints = user.total_points + pointsEarned;

    // Determine new level
    const [levels] = await conn.query(
      'SELECT level_id, name, min_points, max_points, shields_granted FROM LEVEL ORDER BY min_points ASC'
    );

    let newLevelId = user.level_id;
    let leveledUp = false;
    let shieldsGranted = 0;
    let newLevelName = null;

    for (const lvl of levels) {
      if (newTotalPoints >= lvl.min_points && newTotalPoints <= lvl.max_points) {
        if (lvl.level_id !== user.level_id) {
          leveledUp = true;
          newLevelId = lvl.level_id;
          shieldsGranted = lvl.shields_granted;
          newLevelName = lvl.name;
        }
        break;
      }
    }

    // Persist updated user stats
    await conn.query(
      `UPDATE USER
       SET total_points      = ?,
           current_streak    = ?,
           longest_streak    = ?,
           level_id          = ?,
           shields_available = shields_available + ?
       WHERE user_id = ?`,
      [newTotalPoints, newStreak, newLongest, newLevelId, shieldsGranted, userId]
    );

    // ── Step 4: Challenge progress ─────────────────────────────────────
    const challengeUpdates = [];

    if (allPassed || shieldUsed) {
      // Only count the day if the user effectively "passed" (with or without shield)
      const [activeChallenges] = await conn.query(
        `SELECT uc.uc_id, uc.days_completed, c.target_days, c.bonus_points, c.type, c.challenge_id
         FROM USER_CHALLENGE uc
         JOIN CHALLENGE c ON uc.challenge_id = c.challenge_id
         WHERE uc.user_id = ? AND uc.status = 'IN_PROGRESS'`,
        [userId]
      );

      for (const uc of activeChallenges) {
        const newDaysCompleted = uc.days_completed + 1;
        let newStatus = 'IN_PROGRESS';
        let bonusAwarded = false;
        let bonusPoints = 0;

        if (newDaysCompleted >= uc.target_days) {
          newStatus = 'COMPLETED';

          if (uc.type === 'SOLO') {
            // Award bonus immediately for solo challenges
            bonusPoints = uc.bonus_points;
            bonusAwarded = true;

            await conn.query(
              'UPDATE USER SET total_points = total_points + ? WHERE user_id = ?',
              [bonusPoints, userId]
            );
          } else if (uc.type === 'GROUP') {
            // For group challenges, check if ALL members are now completed
            await conn.query(
              `UPDATE USER_CHALLENGE SET days_completed = ?, status = 'COMPLETED'
               WHERE uc_id = ?`,
              [newDaysCompleted, uc.uc_id]
            );

            const [[gcRow]] = await conn.query(
              `SELECT gc.gc_id, gc.group_bonus_points, gc.challenge_id
               FROM GROUP_CHALLENGE gc WHERE gc.challenge_id = ?`,
              [uc.challenge_id]
            );

            if (gcRow) {
              // Count how many members have NOT yet completed
              const [[{ pending }]] = await conn.query(
                `SELECT COUNT(*) AS pending
                 FROM USER_CHALLENGE
                 WHERE challenge_id = ? AND status != 'COMPLETED'`,
                [uc.challenge_id]
              );

              if (pending === 0) {
                // All members done — grant group bonus to everyone
                await conn.query(
                  `UPDATE USER u
                   JOIN USER_CHALLENGE uc2 ON u.user_id = uc2.user_id
                   SET u.total_points = u.total_points + ?,
                       uc2.bonus_awarded = TRUE
                   WHERE uc2.challenge_id = ? AND uc2.status = 'COMPLETED'`,
                  [gcRow.group_bonus_points, uc.challenge_id]
                );

                await conn.query(
                  'UPDATE GROUP_CHALLENGE SET all_passed = TRUE WHERE gc_id = ?',
                  [gcRow.gc_id]
                );

                bonusPoints = gcRow.group_bonus_points;
                bonusAwarded = true;
              }
            }

            challengeUpdates.push({
              challenge_id: uc.challenge_id,
              status: newStatus,
              days_completed: newDaysCompleted,
              bonus_awarded: bonusAwarded,
              bonus_points: bonusPoints
            });
            continue; // already updated above for GROUP
          }
        }

        await conn.query(
          `UPDATE USER_CHALLENGE
           SET days_completed = ?, status = ?, bonus_awarded = ?
           WHERE uc_id = ?`,
          [newDaysCompleted, newStatus, bonusAwarded, uc.uc_id]
        );

        challengeUpdates.push({
          challenge_id: uc.challenge_id,
          status: newStatus,
          days_completed: newDaysCompleted,
          bonus_awarded: bonusAwarded,
          bonus_points: bonusPoints
        });
      }
    }

    await conn.commit();
    conn.release();

    // ── Response ───────────────────────────────────────────────────────
    res.status(201).json({
      message: 'Screen time logged successfully.',
      summary: {
        date,
        all_passed: allPassed,
        points_earned_today: pointsEarned,
        total_points: newTotalPoints + (challengeUpdates.reduce((s, c) => s + (c.bonus_points || 0), 0)),
        streak: {
          current: newStreak,
          longest: newLongest,
          shield_used: shieldUsed,
          streak_broken: streakBroken
        },
        level_up: leveledUp
          ? { leveled_up: true, new_level: newLevelName, shields_granted: shieldsGranted }
          : { leveled_up: false },
        challenges: challengeUpdates
      },
      logs: logResults
    });

  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Submit log error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─────────────────────────────────────────────
//  GET /api/logs?date=YYYY-MM-DD
//  Returns all screen logs for the authenticated user on a given date.
//  If no date provided, returns today's logs.
// ─────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [logs] = await db.query(
      `SELECT sl.*, al.app_name, al.daily_limit_min
       FROM SCREEN_LOG sl
       JOIN APP_LIMIT al ON sl.limit_id = al.limit_id
       WHERE sl.user_id = ? AND sl.log_date = ?
       ORDER BY sl.log_id ASC`,
      [userId, date]
    );

    res.json({ date, logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  GET /api/logs/history?limit=30
//  Returns log history grouped by date (most recent first)
// ─────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;

    const [history] = await db.query(
      `SELECT
         log_date,
         COUNT(*) AS apps_logged,
         SUM(CASE WHEN limit_breached = FALSE THEN 1 ELSE 0 END) AS apps_passed,
         SUM(CASE WHEN limit_breached = TRUE  THEN 1 ELSE 0 END) AS apps_failed,
         SUM(points_earned) AS points_earned,
         MAX(shield_used)   AS shield_used
       FROM SCREEN_LOG
       WHERE user_id = ?
       GROUP BY log_date
       ORDER BY log_date DESC
       LIMIT ?`,
      [userId, limit]
    );

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
