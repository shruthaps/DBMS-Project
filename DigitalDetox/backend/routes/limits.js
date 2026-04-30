const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get all active limits for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [limits] = await db.query(
      'SELECT * FROM APP_LIMIT WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );
    res.json(limits);
  } catch (error) {
    console.error('Get limits error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new app limit
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { app_name, platform, daily_limit_min } = req.body;

    if (!app_name || daily_limit_min === undefined) {
      return res.status(400).json({ message: 'app_name and daily_limit_min are required' });
    }

    const [result] = await db.query(
      'INSERT INTO APP_LIMIT (user_id, app_name, platform, daily_limit_min) VALUES (?, ?, ?, ?)',
      [userId, app_name, platform || 'General', daily_limit_min]
    );

    res.status(201).json({
      message: 'App limit added successfully',
      limit: {
        limit_id: result.insertId,
        user_id: userId,
        app_name,
        platform: platform || 'General',
        daily_limit_min,
        is_active: true
      }
    });
  } catch (error) {
    console.error('Add limit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an app limit (e.g., change minutes or deactivate)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limitId = req.params.id;
    const { daily_limit_min, is_active } = req.body;

    // Check if limit belongs to user
    const [existing] = await db.query('SELECT * FROM APP_LIMIT WHERE limit_id = ? AND user_id = ?', [limitId, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Limit not found or unauthorized' });
    }

    const newLimit = daily_limit_min !== undefined ? daily_limit_min : existing[0].daily_limit_min;
    const newActive = is_active !== undefined ? is_active : existing[0].is_active;

    await db.query(
      'UPDATE APP_LIMIT SET daily_limit_min = ?, is_active = ? WHERE limit_id = ? AND user_id = ?',
      [newLimit, newActive, limitId, userId]
    );

    res.json({ message: 'App limit updated successfully' });
  } catch (error) {
    console.error('Update limit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an app limit permanently
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limitId = req.params.id;

    const [result] = await db.query('DELETE FROM APP_LIMIT WHERE limit_id = ? AND user_id = ?', [limitId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Limit not found or unauthorized' });
    }

    res.json({ message: 'App limit deleted successfully' });
  } catch (error) {
    console.error('Delete limit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
