'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { RECOVERY_QUEUE } = require('../queues/queueNames');
const { runWithSpan } = require('../config/tracing');
const { runRecoverySweep } = require('../jobs/recoveryJobs');

const createRecoveryWorker = ({ concurrency }) =>
  new Worker(RECOVERY_QUEUE, (job) => runWithSpan(
    'queue.process',
    {
      'messaging.system': 'bullmq',
      'messaging.destination.name': RECOVERY_QUEUE,
      'messaging.operation': 'process',
      'freightflow.queue.job_name': job.name,
      'freightflow.queue.job_id': job.id,
    },
    () => runRecoverySweep(job)
  ), {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createRecoveryWorker,
};
