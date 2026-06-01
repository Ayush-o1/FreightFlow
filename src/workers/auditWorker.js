'use strict';

const { Worker } = require('bullmq');
const { createIORedisConnection } = require('../config/redis');
const { AUDIT_QUEUE } = require('../queues/queueNames');
const { writeAuditLog } = require('../jobs/auditJobs');

const createAuditWorker = ({ concurrency }) =>
  new Worker(AUDIT_QUEUE, writeAuditLog, {
    connection: createIORedisConnection(),
    concurrency,
  });

module.exports = {
  createAuditWorker,
};
