module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/**/*.test.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js']
};