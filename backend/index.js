const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DigitalDetox API is running' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
