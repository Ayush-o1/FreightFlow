'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { RECOVERY_QUEUE } = require('../queues/queueNames');
const { runRecoverySweep } = require('../jobs/recoveryJobs');

const createRecoveryWorker = ({ concurrency }) =>
  new Worker(RECOVERY_QUEUE, runRecoverySweep, {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createRecoveryWorker,
};
