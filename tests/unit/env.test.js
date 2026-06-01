'use strict';

const withEnv = (overrides, assertion) => {
  const original = { ...process.env };
  jest.isolateModules(() => {
    try {
      Object.keys(process.env).forEach((key) => delete process.env[key]);
      Object.assign(process.env, {
        NODE_ENV: 'development',
        PORT: '5001',
        MONGODB_URI: 'mongodb://localhost:27017/freightflow_test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        CLIENT_URL: 'http://localhost:5173',
        COOKIE_SECURE: 'false',
        COOKIE_SAME_SITE: 'strict',
        REDIS_URL: 'redis://127.0.0.1:6379',
        QUEUE_CONCURRENCY: '2',
        CACHE_TTL: '300',
        ...overrides,
      });

      assertion(require('../../src/config/env'));
    } finally {
      Object.keys(process.env).forEach((key) => delete process.env[key]);
      Object.assign(process.env, original);
    }
  });
};

describe('environment validation', () => {
  test('normalizes valid development configuration and caches getEnv', () => {
    withEnv({ MONGODB_URI: '', MONGO_URI: 'mongodb://localhost:27017/fallback' }, ({ validateEnv, getEnv }) => {
      const env = validateEnv();
      expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/fallback');
      expect(env.COOKIE_SECURE).toBe(false);
      expect(env.QUEUE_CONCURRENCY).toBe(2);
      expect(getEnv()).toBe(env);
    });
  });

  test('accepts production cookie settings when deployment configuration is safe', () => {
    withEnv(
      {
        NODE_ENV: 'production',
        CLIENT_URL: 'https://freightflow.example.com',
        COOKIE_SECURE: 'true',
        COOKIE_SAME_SITE: 'none',
      },
      ({ validateEnv }) => {
        expect(validateEnv().COOKIE_SAME_SITE).toBe('none');
      }
    );
  });

  test('rejects unsafe production and Redis configuration', () => {
    withEnv({ NODE_ENV: 'production', CLIENT_URL: '*', COOKIE_SECURE: 'true' }, ({ validateEnv }) => {
      expect(() => validateEnv()).toThrow(/CLIENT_URL/);
    });

    withEnv({ REDIS_URL: 'not-a-url' }, ({ validateEnv }) => {
      expect(() => validateEnv()).toThrow(/REDIS_URL/);
    });

    withEnv({ COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' }, ({ validateEnv }) => {
      expect(() => validateEnv()).toThrow(/COOKIE_SAME_SITE=none/);
    });
  });
});
