'use strict';

const OutboxEvent = require('../models/OutboxEvent');
const { getNotificationQueue } = require('../queues');
const { getIO } = require('../utils/getIO');
const logger = require('../config/logger');
const { recordSocketEvent } = require('../services/metricsService');
const { runWithSpan } = require('../config/tracing');

const emitSocketEvents = (event) => {
  const io = getIO();
  if (!io) return;

  const { payload = {} } = event;
  const room = payload.room || (payload.shipmentId ? `shipment_${payload.shipmentId}` : null);

  if (!room) return;

  (payload.socketEvents || []).forEach(({ name, data }) => {
    runWithSpan(
      'socket.emit',
      {
        'network.protocol.name': 'socket.io',
        'freightflow.socket.event': name,
        'freightflow.socket.room': room,
        'freightflow.outbox_event_id': event._id.toString(),
        'freightflow.request_id': event.metadata?.requestId || 'unknown',
      },
      async () => {
        io.to(room).emit(name, data);
        recordSocketEvent(name, 'server', 'emitted');
      }
    ).catch((error) => {
      recordSocketEvent(name, 'server', 'error');
      logger.warn({ err: error, room, name }, 'Socket emit trace failed');
    });
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
