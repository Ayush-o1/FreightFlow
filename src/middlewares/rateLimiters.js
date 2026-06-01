'use strict';

const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

let rateLimitScriptSha = null;

const buildHandler = (message) => (req, res) => {
  const body = {
    success: false,
    statusCode: 429,
    message,
  };

  if (res.locals?.requestId) body.requestId = res.locals.requestId;

  res.status(429).json(body);
};

const shouldSkip = () =>
  process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMITS_IN_TEST !== 'true';

const getClientKey = (req, prefix) => {
  const userPart = req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`;
  return `rate-limit:${prefix}:${userPart}`;
};

const runRateLimitScript = async (key, windowMs) => {
  const client = getRedisClient();
  if (!rateLimitScriptSha) {
    rateLimitScriptSha = await client.scriptLoad(RATE_LIMIT_SCRIPT);
  }

  try {
    return await client.evalSha(rateLimitScriptSha, {
      keys: [key],
      arguments: [String(windowMs)],
    });
  } catch (error) {
    if (!String(error.message).includes('NOSCRIPT')) throw error;
    rateLimitScriptSha = await client.scriptLoad(RATE_LIMIT_SCRIPT);
    return client.evalSha(rateLimitScriptSha, {
      keys: [key],
      arguments: [String(windowMs)],
    });
  }
};

const createRedisRateLimiter = ({ prefix, windowMs, max, message }) => {
  const handler = buildHandler(message);

  return async (req, res, next) => {
    if (shouldSkip()) return next();

    try {
      const key = getClientKey(req, prefix);
      const [hits, ttl] = await runRateLimitScript(key, windowMs);
      const resetSeconds = Math.max(1, Math.ceil(Number(ttl) / 1000));
      const remaining = Math.max(0, max - Number(hits));

      res.set('RateLimit-Policy', `${max};w=${Math.ceil(windowMs / 1000)}`);
      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(resetSeconds));

      if (Number(hits) > max) {
        return handler(req, res);
      }

      return next();
    } catch (error) {
      logger.error({ err: error, limiter: prefix }, 'Redis rate limiter failed');
      return next(error);
    }
  };
};

const authLimiter = createRedisRateLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests. Please try again after 15 minutes.',
});

const refreshLimiter = createRedisRateLimiter({
  prefix: 'refresh',
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many token refresh attempts. Please try again later.',
});

const generalLimiter = createRedisRateLimiter({
  prefix: 'general',
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests. Please slow down and try again later.',
});

module.exports = {
  authLimiter,
  refreshLimiter,
  generalLimiter,
  createRedisRateLimiter,
};
