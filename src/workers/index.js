'use strict';

const logger = require('../config/logger');
const { getRecoveryQueue } = require('../queues');
const { recordQueueJob } = require('../services/metricsService');
const { createAuditWorker } = require('./auditWorker');
const { createNotificationWorker } = require('./notificationWorker');
const { createOutboxWorker } = require('./outboxWorker');
const { createRecoveryWorker } = require('./recoveryWorker');

let workers = [];

const getConcurrency = () => {
  const parsed = Number(process.env.QUEUE_CONCURRENCY);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
};

const attachWorkerLogging = (worker, name) => {
  worker.on('completed', (job) => {
    recordQueueJob(name, 'completed');
    logger.debug({ queue: name, jobId: job.id }, 'Worker job completed');
  });

  worker.on('failed', (job, error) => {
    recordQueueJob(name, 'failed');
    logger.warn({ queue: name, jobId: job?.id, err: error }, 'Worker job failed');
  });
};

const scheduleRecoverySweep = async () => {
  await getRecoveryQueue().add(
    'recoverySweep',
    {},
    {
      jobId: 'recovery-sweep',
      repeat: {
        every: 5 * 60 * 1000,
      },
    }
  );
};

const startWorkers = async () => {
  if (workers.length > 0) return workers;

  const concurrency = getConcurrency();
  workers = [
    { name: 'auditQueue', worker: createAuditWorker({ concurrency }) },
    { name: 'notificationQueue', worker: createNotificationWorker({ concurrency }) },
    { name: 'outboxQueue', worker: createOutboxWorker({ concurrency }) },
    { name: 'recoveryQueue', worker: createRecoveryWorker({ concurrency: 1 }) },
  ];

  workers.forEach(({ name, worker }) => attachWorkerLogging(worker, name));
  await Promise.all(workers.map(({ worker }) => worker.waitUntilReady()));
  await scheduleRecoverySweep();

  logger.info({ concurrency }, 'BullMQ workers started');
  return workers;
};

const stopWorkers = async () => {
  await Promise.all(workers.map(({ worker }) => worker.close()));
  workers = [];
};

module.exports = {
  startWorkers,
  stopWorkers,
};
