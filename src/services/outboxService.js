'use strict';

const OutboxEvent = require('../models/OutboxEvent');
const { getOutboxQueue } = require('../queues');
const logger = require('../config/logger');

const createOutboxEvent = async ({
  type,
  aggregateType,
  aggregateId,
  payload = {},
  metadata = {},
  session,
}) => {
  const [event] = await OutboxEvent.create(
    [
      {
        type,
        aggregateType,
        aggregateId,
        payload,
        metadata,
      },
    ],
    session ? { session } : undefined
  );

  return event;
};

const enqueueOutboxEvent = (event) => {
  if (!event?._id) return;

  getOutboxQueue()
    .add(
      'publishOutboxEvent',
      { outboxEventId: event._id.toString() },
      {
        jobId: `outbox-${event._id}`,
      }
    )
    .catch((error) => {
      logger.warn(
        { err: error, outboxEventId: event._id.toString(), type: event.type },
        'Outbox enqueue failed; recovery worker will retry'
      );
    });
};

const createAndEnqueueOutboxEvent = async (options) => {
  const event = await createOutboxEvent(options);
  enqueueOutboxEvent(event);
  return event;
};

module.exports = {
  createAndEnqueueOutboxEvent,
  createOutboxEvent,
  enqueueOutboxEvent,
};
