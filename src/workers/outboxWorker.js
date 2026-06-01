'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { OUTBOX_QUEUE } = require('../queues/queueNames');
const { publishOutboxEvent } = require('../jobs/outboxJobs');

const createOutboxWorker = ({ concurrency }) =>
  new Worker(OUTBOX_QUEUE, publishOutboxEvent, {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createOutboxWorker,
};
