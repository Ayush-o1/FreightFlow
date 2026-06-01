'use strict';

const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');
const { getAuditQueue } = require('../queues');

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'rawRefreshToken',
  'cookie',
  'authorization',
]);

const sanitizeMetadata = (value) => {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata);
  }

  return Object.entries(value).reduce((safe, [key, entry]) => {
    if (SENSITIVE_KEYS.has(key)) {
      safe[key] = '[REDACTED]';
      return safe;
    }

    safe[key] = sanitizeMetadata(entry);
    return safe;
  }, {});
};

const buildAuditPayload = (req, event) => {
  const actor = event.actor ?? req?.user?._id ?? null;
  const actorRole = event.actorRole ?? req?.user?.role ?? null;

  return {
    action: event.action,
    status: event.status || 'success',
    actor,
    actorRole,
    targetType: event.targetType || null,
    targetId: event.targetId || null,
    requestId: req?.id || req?.res?.locals?.requestId || null,
    ip: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    metadata: sanitizeMetadata(event.metadata || {}),
  };
};

const recordAuditEvent = (req, event) => {
  const payload = buildAuditPayload(req, event);

  getAuditQueue()
    .add('writeAuditLog', payload, {
      jobId: payload.requestId
        ? `audit-${payload.action}-${payload.requestId}-${payload.targetId || 'none'}`
        : undefined,
    })
    .catch((error) => {
      logger.warn(
        {
          err: error,
          action: payload.action,
          requestId: payload.requestId,
        },
        'Audit log enqueue failed'
      );
    });
};

const recordAuditEventDirect = (req, event) => {
  const payload = buildAuditPayload(req, event);
  return AuditLog.create(payload);
};

module.exports = {
  buildAuditPayload,
  recordAuditEvent,
  recordAuditEventDirect,
};
