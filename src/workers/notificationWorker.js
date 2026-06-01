'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { NOTIFICATION_QUEUE } = require('../queues/queueNames');
const { processNotificationJob } = require('../jobs/notificationJobs');

const createNotificationWorker = ({ concurrency }) =>
  new Worker(NOTIFICATION_QUEUE, processNotificationJob, {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createNotificationWorker,
};
