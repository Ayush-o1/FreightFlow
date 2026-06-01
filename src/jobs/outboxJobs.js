'use strict';

const OutboxEvent = require('../models/OutboxEvent');
const { getNotificationQueue } = require('../queues');
const { getIO } = require('../utils/getIO');
const logger = require('../config/logger');

const emitSocketEvents = (event) => {
  const io = getIO();
  if (!io) return;

  const { payload = {} } = event;
  const room = payload.room || (payload.shipmentId ? `shipment_${payload.shipmentId}` : null);

  if (!room) return;

  (payload.socketEvents || []).forEach(({ name, data }) => {
    io.to(room).emit(name, data);
    logger.debug({ outboxEventId: event._id, room, name }, 'Outbox socket event emitted');
  });
};

const enqueueNotification = async (event) => {
  const { payload = {} } = event;
  if (!payload.notification) return null;

  const queue = getNotificationQueue();
  return queue.add(
    'deliverNotification',
    payload.notification,
    {
      jobId: `notification-${event._id}`,
    }
  );
};

const publishOutboxEvent = async (job) => {
  const { outboxEventId } = job.data;

  const event = await OutboxEvent.findOneAndUpdate(
    {
      _id: outboxEventId,
      status: { $in: ['pending', 'failed'] },
    },
    {
      $set: {
        status: 'processing',
        lastError: null,
      },
      $inc: {
        attempts: 1,
      },
    },
    { returnDocument: 'after' }
  );

  if (!event) {
    return { skipped: true, outboxEventId };
  }

  try {
    emitSocketEvents(event);
    await enqueueNotification(event);

    await OutboxEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: 'published',
          processedAt: new Date(),
          lastError: null,
        },
      }
    );

    return {
      published: true,
      outboxEventId,
      type: event.type,
    };
  } catch (error) {
    await OutboxEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: 'failed',
          lastError: error.message,
          availableAt: new Date(Date.now() + 60 * 1000),
        },
      }
    );
    throw error;
  }
};

module.exports = {
  publishOutboxEvent,
};
