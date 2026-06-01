'use strict';

const { z } = require('zod');

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI or MONGO_URI is required.'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  CLIENT_URL: z.string().min(1, 'CLIENT_URL is required.'),
  COOKIE_SECURE: z.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_DOMAIN: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
});

let cachedEnv = null;

const validateEnv = () => {
  const merged = {
    ...process.env,
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    COOKIE_SECURE: parseBoolean(
      process.env.COOKIE_SECURE,
      process.env.NODE_ENV === 'production'
    ),
    COOKIE_SAME_SITE: String(process.env.COOKIE_SAME_SITE || 'strict').toLowerCase(),
  };

  const parsed = envSchema.safeParse(merged);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration. ${detail}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) {
      throw new Error('Invalid environment configuration. COOKIE_SECURE must be true in production.');
    }

    if (env.CLIENT_URL === '*') {
      throw new Error('Invalid environment configuration. CLIENT_URL cannot be * in production.');
    }
  }

  if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE) {
    throw new Error('Invalid environment configuration. COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.');
  }

  process.env.MONGODB_URI = env.MONGODB_URI;
  process.env.JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
  process.env.CLIENT_URL = env.CLIENT_URL;
  process.env.COOKIE_SECURE = String(env.COOKIE_SECURE);
  process.env.COOKIE_SAME_SITE = env.COOKIE_SAME_SITE;
  process.env.ACCESS_TOKEN_COOKIE_MAX_AGE_MS = String(env.ACCESS_TOKEN_COOKIE_MAX_AGE_MS);

  cachedEnv = env;
  return env;
};

const getEnv = () => cachedEnv || validateEnv();

module.exports = {
  getEnv,
  validateEnv,
};
