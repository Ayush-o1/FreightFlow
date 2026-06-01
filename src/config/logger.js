'use strict';

const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  enabled: process.env.LOG_ENABLED !== 'false' && !isTest,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    service: 'freightflow-api',
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'req.headers["set-cookie"]',
      'res.headers["set-cookie"]',
      'request.headers.authorization',
      'request.headers.cookie',
      'request.headers["x-csrf-token"]',
      'response.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.rawRefreshToken',
      '*.ff_access_token',
      '*.ff_refresh_token',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
