const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header (Format: "Bearer <token>")
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.user = decoded; // Adds the decoded payload (e.g. { id, email }) to req
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
