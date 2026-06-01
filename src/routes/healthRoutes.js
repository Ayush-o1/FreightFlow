'use strict';

const express = require('express');
const pkg = require('../../package.json');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { getMongoReadiness } = require('../config/db');

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

router.get('/ready', (req, res) => {
  const mongo = getMongoReadiness();
  const ready = mongo.ready;

  const payload = {
    ready,
    dependencies: {
      mongo,
    },
    timestamp: new Date().toISOString(),
  };

  if (!ready) {
    return errorResponse(res, 503, 'FreightFlow API is not ready.', payload);
  }

  return successResponse(res, 200, 'FreightFlow API is ready.', payload);
});

router.get('/health', (req, res) => {
  const mongo = getMongoReadiness();
  const live = getLivePayload();

  successResponse(res, 200, 'FreightFlow API health summary.', {
    live: live.live,
    ready: mongo.ready,
    version: pkg.version,
    uptimeSeconds: live.uptimeSeconds,
    environment: live.environment,
    dependencies: {
      mongo,
    },
    timestamp: live.timestamp,
  });
});

module.exports = router;
