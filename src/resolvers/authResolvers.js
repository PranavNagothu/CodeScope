const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const authResolvers = {
  Mutation: {
    register: async (_, { username, email, password }) => {
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        throw new Error(
          existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken'
        );
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const user = await User.create({ username, email, password });
      const token = generateToken(user._id);

      logger.info(`New user registered: ${username} (${email})`);

      return {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          analysisCount: user.analysisCount,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isValid = await user.comparePassword(password);

      if (!isValid) {
        throw new Error('Invalid email or password');
      }

      const token = generateToken(user._id);

      logger.info(`User logged in: ${user.username}`);

      return {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          analysisCount: user.analysisCount,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },
  },
};

module.exports = authResolvers;
