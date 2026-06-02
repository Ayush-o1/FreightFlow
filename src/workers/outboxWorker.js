'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { OUTBOX_QUEUE } = require('../queues/queueNames');
const { runWithSpan } = require('../config/tracing');
const { publishOutboxEvent } = require('../jobs/outboxJobs');

const createOutboxWorker = ({ concurrency }) =>
  new Worker(OUTBOX_QUEUE, (job) => runWithSpan(
    'queue.process',
    {
      'messaging.system': 'bullmq',
      'messaging.destination.name': OUTBOX_QUEUE,
      'messaging.operation': 'process',
      'freightflow.queue.job_name': job.name,
      'freightflow.queue.job_id': job.id,
      'freightflow.outbox_event_id': job.data?.outboxEventId || 'unknown',
    },
    () => publishOutboxEvent(job)
  ), {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createOutboxWorker,
};
