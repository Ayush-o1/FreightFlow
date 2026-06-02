'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { NOTIFICATION_QUEUE } = require('../queues/queueNames');
const { runWithSpan } = require('../config/tracing');
const { processNotificationJob } = require('../jobs/notificationJobs');

const createNotificationWorker = ({ concurrency }) =>
  new Worker(NOTIFICATION_QUEUE, (job) => runWithSpan(
    'queue.process',
    {
      'messaging.system': 'bullmq',
      'messaging.destination.name': NOTIFICATION_QUEUE,
      'messaging.operation': 'process',
      'freightflow.queue.job_name': job.name,
      'freightflow.queue.job_id': job.id,
      'freightflow.notification_type': job.data?.type || 'unknown',
    },
    () => processNotificationJob(job)
  ), {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createNotificationWorker,
};
