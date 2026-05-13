const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const [existingUsers] = await db.query('SELECT * FROM USER WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Get default Bronze level_id (which should be 1 based on schema)
    const [levels] = await db.query('SELECT level_id FROM LEVEL WHERE name = ?', ['Bronze']);
    const level_id = levels.length > 0 ? levels[0].level_id : null;

    // Insert user
    const [result] = await db.query(
      'INSERT INTO USER (name, email, password_hash, level_id) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, level_id]
    );

    // Create token
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
    const token = jwt.sign({ id: result.insertId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        level_id
      }
    });

  } catch (error) {
    console.error('Register error details:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const [users] = await db.query('SELECT * FROM USER WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
    const token = jwt.sign({ id: user.user_id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        level_id: user.level_id,
        total_points: user.total_points,
        current_streak: user.current_streak
      }
    });

  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

module.exports = router;
