'use strict';

const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');
const { errorResponse } = require('../utils/responseFormatter');
const { BAD_REQUEST, CONFLICT } = require('../utils/httpStatus');

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const hashScope = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const buildIdempotencyKey = (req, headerValue) => {
  const userId = req.user?._id?.toString() || 'anonymous';
  return `idempotency:${userId}:${hashScope(`${req.method}:${req.originalUrl}:${headerValue}`)}`;
};

const idempotency = ({ required = true } = {}) => async (req, res, next) => {
  try {
    const headerValue = req.get('Idempotency-Key');

    if (!headerValue) {
      if (!required) return next();
      return errorResponse(res, BAD_REQUEST, 'Idempotency-Key header is required.');
    }

    if (headerValue.length > 128) {
      return errorResponse(res, BAD_REQUEST, 'Idempotency-Key must be 128 characters or fewer.');
    }

    const client = getRedisClient();
    const key = buildIdempotencyKey(req, headerValue);
    const existing = await client.get(key);

    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.state === 'completed') {
        res.set('Idempotency-Replayed', 'true');
        return res.status(parsed.statusCode).json(parsed.body);
      }

      return errorResponse(res, CONFLICT, 'A request with this Idempotency-Key is already processing.');
    }

    const reserved = await client.set(
      key,
      JSON.stringify({ state: 'processing', startedAt: new Date().toISOString() }),
      {
        NX: true,
        EX: IDEMPOTENCY_TTL_SECONDS,
      }
    );

    if (!reserved) {
      return errorResponse(res, CONFLICT, 'A request with this Idempotency-Key is already processing.');
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const statusCode = res.statusCode;
      const cachePayload = {
        state: statusCode >= 200 && statusCode < 300 ? 'completed' : 'failed',
        statusCode,
        body,
        completedAt: new Date().toISOString(),
      };

      const operation = cachePayload.state === 'completed'
        ? client.set(key, JSON.stringify(cachePayload), { EX: IDEMPOTENCY_TTL_SECONDS })
        : client.del(key);

      operation.catch(() => undefined);
      return originalJson(body);
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  idempotency,
};
