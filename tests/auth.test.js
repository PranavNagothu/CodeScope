const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRY = '1h';

const { generateToken, getUser } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(userId);
    });

    it('should generate tokens with expiry', () => {
      const token = generateToken('507f1f77bcf86cd799439011');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('getUser', () => {
    it('should return null for empty token', async () => {
      const user = await getUser('');
      expect(user).toBeNull();
    });

    it('should return null for null token', async () => {
      const user = await getUser(null);
      expect(user).toBeNull();
    });

    it('should return null for invalid token', async () => {
      const user = await getUser('invalid-token');
      expect(user).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      const user = await getUser(expiredToken);
      expect(user).toBeNull();
    });
  });
});

describe('Password Hashing', () => {
  it('should hash password correctly', async () => {
    const password = 'testPassword123';
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    expect(hashed).not.toBe(password);
    expect(hashed.length).toBeGreaterThan(50);
  });

  it('should verify correct password', async () => {
    const password = 'testPassword123';
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const isMatch = await bcrypt.compare(password, hashed);
    expect(isMatch).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'testPassword123';
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const isMatch = await bcrypt.compare('wrongPassword', hashed);
    expect(isMatch).toBe(false);
  });
});
