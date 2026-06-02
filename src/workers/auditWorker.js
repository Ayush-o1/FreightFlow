'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { AUDIT_QUEUE } = require('../queues/queueNames');
const { runWithSpan } = require('../config/tracing');
const { writeAuditLog } = require('../jobs/auditJobs');

const createAuditWorker = ({ concurrency }) =>
  new Worker(AUDIT_QUEUE, (job) => runWithSpan(
    'queue.process',
    {
      'messaging.system': 'bullmq',
      'messaging.destination.name': AUDIT_QUEUE,
      'messaging.operation': 'process',
      'freightflow.queue.job_name': job.name,
      'freightflow.queue.job_id': job.id,
      'freightflow.request_id': job.data?.requestId || 'unknown',
    },
    () => writeAuditLog(job)
  ), {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createAuditWorker,
};
