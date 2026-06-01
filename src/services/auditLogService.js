'use strict';

const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

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

const recordAuditEvent = (req, event) => {
  const actor = event.actor ?? req?.user?._id ?? null;
  const actorRole = event.actorRole ?? req?.user?.role ?? null;

  const payload = {
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

  AuditLog.create(payload).catch((error) => {
    logger.warn(
      {
        err: error,
        action: payload.action,
        requestId: payload.requestId,
      },
      'Audit log write failed'
    );
  });
};

module.exports = {
  recordAuditEvent,
};
