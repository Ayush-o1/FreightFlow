'use strict';

const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    aggregateType: {
      type: String,
      required: true,
      trim: true,
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'published', 'failed'],
      default: 'pending',
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
    },
    availableAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

outboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
outboxEventSchema.index({ type: 1, createdAt: -1 });

outboxEventSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);

module.exports = OutboxEvent;
