'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/testEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 60000,
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**',
    '!src/config/logger.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 75,
      lines: 80,
    },
    './src/controllers/authController.js': {
      statements: 85,
      lines: 85,
    },
    './src/middlewares/auth.js': {
      statements: 85,
      lines: 85,
    },
    './src/middlewares/csrfProtection.js': {
      statements: 85,
      lines: 85,
    },
  },
};
