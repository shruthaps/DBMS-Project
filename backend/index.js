const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Auth Routes
app.use('/api/auth', require('./routes/auth'));

// App Limits Routes
app.use('/api/limits', require('./routes/limits'));

// Screen Log Routes
app.use('/api/logs', require('./routes/logs'));

// Challenge Routes
app.use('/api/challenges', require('./routes/challenges'));

// Coupon Routes
app.use('/api/coupons', require('./routes/coupons'));

// Profile Route
app.use('/api/profile', require('./routes/profile'));

// Friends Route
app.use('/api/friends', require('./routes/friends'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DigitalDetox API is running' });
});

// Start the server
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  
  // Auto-seed the database with challenges and verify level points
  const seedDatabase = require('./seed');
  await seedDatabase();
});
