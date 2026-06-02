'use strict';

const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');
const { recordCacheOperation } = require('./metricsService');

const DEFAULT_TTL_SECONDS = 300;

const getCacheTtl = () => {
  const parsed = Number(process.env.CACHE_TTL);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SECONDS;
};

const getJsonCache = async (key) => {
  const client = getRedisClient();
  const cached = await client.get(key);

  if (!cached) {
    recordCacheOperation('get', 'miss');
    logger.debug({ key }, 'Redis cache miss');
    return null;
  }

  recordCacheOperation('get', 'hit');
  logger.debug({ key }, 'Redis cache hit');
  return JSON.parse(cached);
};

const setJsonCache = async (key, value, ttlSeconds = getCacheTtl()) => {
  const client = getRedisClient();
  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
};

const deleteCacheByPattern = async (pattern) => {
  const client = getRedisClient();
  const keys = [];

  for await (const keyOrBatch of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    if (Array.isArray(keyOrBatch)) {
      keys.push(...keyOrBatch);
    } else {
      keys.push(keyOrBatch);
    }
  }

  if (keys.length > 0) {
    await client.del(keys);
  }

  logger.debug({ pattern, count: keys.length }, 'Redis cache invalidated');
  return keys.length;
};

module.exports = {
  deleteCacheByPattern,
  getCacheTtl,
  getJsonCache,
  setJsonCache,
};
