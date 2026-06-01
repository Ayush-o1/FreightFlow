'use strict';

const logger = require('../config/logger');

const logNotification = (type, payload) => {
  logger.info(
    {
      notificationType: type,
      shipmentId: payload.shipmentId || null,
      userId: payload.userId || payload.shipperId || payload.driverId || null,
    },
    'Notification job processed'
  );
};

const processNotificationJob = async (job) => {
  const { type, payload = {} } = job.data;

  switch (type) {
    case 'shipment.created':
    case 'shipment.assigned':
    case 'shipment.cancelled':
    case 'shipment.status_updated':
    case 'shipment.delivered':
    case 'user.activated':
    case 'user.deactivated':
      logNotification(type, payload);
      return { delivered: true, type };

    default:
      throw new Error(`Unsupported notification job type: ${type}`);
  }
};

module.exports = {
  processNotificationJob,
};
