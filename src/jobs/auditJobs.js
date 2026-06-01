'use strict';

const AuditLog = require('../models/AuditLog');

const writeAuditLog = async (job) => {
  const auditLog = await AuditLog.create(job.data);
  return {
    auditLogId: auditLog._id.toString(),
    action: auditLog.action,
  };
};

module.exports = {
  writeAuditLog,
};
