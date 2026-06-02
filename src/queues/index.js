'use strict';

const { Queue, QueueEvents } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const logger = require('../config/logger');
const { recordQueueJob } = require('../services/metricsService');
const { runWithSpan } = require('../config/tracing');
const {
  AUDIT_QUEUE,
  FUTURE_PAYMENT_QUEUE,
  NOTIFICATION_QUEUE,
  OUTBOX_QUEUE,
  RECOVERY_QUEUE,
} = require('./queueNames');

let queueConnection = null;
const queues = new Map();
const queueEvents = new Map();

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    age: 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 24 * 60 * 60,
  },
};

const getQueueConnection = () => {
  if (!queueConnection) {
    queueConnection = createIORedisConnection();
  }

  return queueConnection;
};

const getQueue = (name) => {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getQueueConnection(),
      defaultJobOptions,
    });
    const originalAdd = queue.add.bind(queue);

    queue.add = async (jobName, data, options) =>
      runWithSpan(
        'queue.enqueue',
        {
          'messaging.system': 'bullmq',
          'messaging.destination.name': name,
          'messaging.operation': 'publish',
          'freightflow.queue.job_name': jobName,
        },
        async () => {
          try {
            const job = await originalAdd(jobName, data, options);
            recordQueueJob(name, 'enqueued');
            return job;
          } catch (error) {
            recordQueueJob(name, 'enqueue_failed');
            throw error;
          }
        }
      );

    queues.set(name, queue);
  }

  return queues.get(name);
};

const getQueueEvents = (name) => {
  if (!queueEvents.has(name)) {
    const events = new QueueEvents(name, {
      connection: createIORedisConnection(),
    });

    events.on('failed', ({ jobId, failedReason }) => {
      recordQueueJob(name, 'failed');
      logger.warn({ queue: name, jobId, failedReason }, 'Queue job failed');
    });

    events.on('completed', () => {
      recordQueueJob(name, 'completed');
    });

    queueEvents.set(name, events);
  }

  return queueEvents.get(name);
};

const getAuditQueue = () => getQueue(AUDIT_QUEUE);
const getFuturePaymentQueue = () => getQueue(FUTURE_PAYMENT_QUEUE);
const getNotificationQueue = () => getQueue(NOTIFICATION_QUEUE);
const getOutboxQueue = () => getQueue(OUTBOX_QUEUE);
const getRecoveryQueue = () => getQueue(RECOVERY_QUEUE);

const closeQueues = async () => {
  await Promise.all([...queueEvents.values()].map((events) => events.close()));
  await Promise.all([...queues.values()].map((queue) => queue.close()));

  queueEvents.clear();
  queues.clear();

  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = null;
  }
};

module.exports = {
  closeQueues,
  getAuditQueue,
  getFuturePaymentQueue,
  getNotificationQueue,
  getOutboxQueue,
  getQueue,
  getQueueEvents,
  getRecoveryQueue,
};
