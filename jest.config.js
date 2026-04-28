module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/utils/seed.js',
  ],
  testMatch: ['**/tests/**/*.test.js'],
};
