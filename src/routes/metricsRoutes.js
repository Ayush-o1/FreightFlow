'use strict';

const express = require('express');
const {
  getMetrics,
  register,
  setDependencyReady,
  setQueueBacklog,
} = require('../services/metricsService');
const { getMongoReadiness } = require('../config/db');
const { getRedisReadiness } = require('../config/redis');
const { getQueue } = require('../queues');
const {
  AUDIT_QUEUE,
  FUTURE_PAYMENT_QUEUE,
  NOTIFICATION_QUEUE,
  OUTBOX_QUEUE,
  RECOVERY_QUEUE,
} = require('../queues/queueNames');

const router = express.Router();

const QUEUE_NAMES = [
  AUDIT_QUEUE,
  FUTURE_PAYMENT_QUEUE,
  NOTIFICATION_QUEUE,
  OUTBOX_QUEUE,
  RECOVERY_QUEUE,
];

const refreshQueueBacklogMetrics = async () => {
  await Promise.all(
    QUEUE_NAMES.map(async (queueName) => {
      try {
        const queue = getQueue(queueName);
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'paused',
          'prioritized'
        );
        setQueueBacklog(queueName, { ...counts, unavailable: 0 });
      } catch {
        setQueueBacklog(queueName, { unavailable: 1 });
      }
    })
  );
};

const refreshDependencyMetrics = async () => {
  const mongo = getMongoReadiness();
  const redis = await getRedisReadiness();

  setDependencyReady('mongo', mongo.ready);
  setDependencyReady('redis', redis.ready);

  return { mongo, redis };
};

router.get('/metrics', async (req, res, next) => {
  try {
    const { redis } = await refreshDependencyMetrics();
    if (redis.ready) {
      await refreshQueueBacklogMetrics();
    } else {
      QUEUE_NAMES.forEach((queueName) => setQueueBacklog(queueName, { unavailable: 1 }));
    }
    res.set('Content-Type', register.contentType);
    res.send(await getMetrics());
  } catch (error) {
    next(error);
  }
});

module.exports = router;
