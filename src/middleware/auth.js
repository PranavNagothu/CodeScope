const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });
}

async function getUser(token) {
  if (!token) return null;

  try {
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).lean();
    return user;
  } catch (error) {
    logger.warn(`Auth token verification failed: ${error.message}`);
    return null;
  }
}

function requireAuth(user) {
  if (!user) {
    throw new Error('Authentication required. Please log in.');
  }
  return user;
}

module.exports = { generateToken, getUser, requireAuth };
