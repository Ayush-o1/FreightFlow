'use strict';

const { connectRedis, disconnectRedis, getRedisClient } = require('../../src/config/redis');
const { closeQueues } = require('../../src/queues');
const { startWorkers, stopWorkers } = require('../../src/workers');

const connectTestRedis = async () => {
  await connectRedis();
  await getRedisClient().flushDb();
};

const clearTestRedis = async () => {
  await getRedisClient().flushDb();
};

const startTestWorkers = async () => {
  await startWorkers();
};

const stopTestRedis = async () => {
  await stopWorkers();
  await closeQueues();
  await disconnectRedis();
};

module.exports = {
  clearTestRedis,
  connectTestRedis,
  startTestWorkers,
  stopTestRedis,
};
