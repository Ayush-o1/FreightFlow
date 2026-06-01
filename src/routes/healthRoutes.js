'use strict';

const express = require('express');
const pkg = require('../../package.json');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { getMongoReadiness } = require('../config/db');
const { getRedisReadiness } = require('../config/redis');

const router = express.Router();

const getLivePayload = () => ({
  live: true,
  environment: process.env.NODE_ENV || 'development',
  uptimeSeconds: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
});

router.get('/live', (req, res) => {
  successResponse(res, 200, 'FreightFlow API process is live.', getLivePayload());
});

router.get('/ready', async (req, res) => {
  const mongo = getMongoReadiness();
  const redis = await getRedisReadiness();
  const ready = mongo.ready && redis.ready;

  const payload = {
    ready,
    dependencies: {
      mongo,
      redis,
    },
    timestamp: new Date().toISOString(),
  };

  if (!ready) {
    return errorResponse(res, 503, 'FreightFlow API is not ready.', payload);
  }

  return successResponse(res, 200, 'FreightFlow API is ready.', payload);
});

router.get('/health', async (req, res) => {
  const mongo = getMongoReadiness();
  const redis = await getRedisReadiness();
  const live = getLivePayload();

  successResponse(res, 200, 'FreightFlow API health summary.', {
    live: live.live,
    ready: mongo.ready && redis.ready,
    version: pkg.version,
    uptimeSeconds: live.uptimeSeconds,
    environment: live.environment,
    dependencies: {
      mongo,
      redis,
    },
    timestamp: live.timestamp,
  });
});

module.exports = router;
