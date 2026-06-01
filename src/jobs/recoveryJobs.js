'use strict';

const Payment = require('../models/Payment');
const Shipment = require('../models/Shipment');
const OutboxEvent = require('../models/OutboxEvent');
const { getAuditQueue, getNotificationQueue } = require('../queues');
const { enqueueOutboxEvent } = require('../services/outboxService');
const logger = require('../config/logger');

const recoverPendingOutboxEvents = async () => {
  const events = await OutboxEvent.find({
    status: { $in: ['pending', 'failed'] },
    availableAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(100);

  events.forEach(enqueueOutboxEvent);

  return {
    discovered: events.length,
    eventIds: events.map((event) => event._id.toString()),
  };
};

const detectStuckPayments = async () => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const count = await Payment.countDocuments({
    status: 'pending',
    createdAt: { $lte: cutoff },
  });

  return { count, cutoff };
};

const detectStaleShipments = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await Shipment.countDocuments({
    status: { $in: ['assigned', 'picked_up', 'in_transit'] },
    updatedAt: { $lte: cutoff },
  });

  return { count, cutoff };
};

const recoverFailedQueueJobs = async () => {
  const [failedAudit, failedNotifications] = await Promise.all([
    getAuditQueue().getFailed(0, 100),
    getNotificationQueue().getFailed(0, 100),
  ]);

  await Promise.all([
    ...failedAudit.map((job) => job.retry()),
    ...failedNotifications.map((job) => job.retry()),
  ]);

  return {
    auditJobsRetried: failedAudit.length,
    notificationJobsRetried: failedNotifications.length,
  };
};

const runRecoverySweep = async () => {
  const [outbox, stuckPayments, staleShipments, queues] = await Promise.all([
    recoverPendingOutboxEvents(),
    detectStuckPayments(),
    detectStaleShipments(),
    recoverFailedQueueJobs(),
  ]);

  const report = {
    outbox,
    stuckPayments,
    staleShipments,
    queues,
    generatedAt: new Date().toISOString(),
  };

  logger.info(report, 'Recovery sweep completed');
  return report;
};

module.exports = {
  detectStaleShipments,
  detectStuckPayments,
  recoverFailedQueueJobs,
  recoverPendingOutboxEvents,
  runRecoverySweep,
};
