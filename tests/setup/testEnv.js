'use strict';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-thirty-two-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-thirty-two-characters';
process.env.JWT_EXPIRES_IN = '15m';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'strict';
process.env.ACCESS_TOKEN_COOKIE_MAX_AGE_MS = '900000';
process.env.LOG_ENABLED = 'false';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
process.env.QUEUE_CONCURRENCY = '2';
process.env.CACHE_TTL = '300';
process.env.QUEUE_WORKERS_ENABLED = 'false';
