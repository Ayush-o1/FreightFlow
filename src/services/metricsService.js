'use strict';

const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
  prefix: 'freightflow_',
  register,
});

const httpRequestsTotal = new client.Counter({
  name: 'freightflow_http_requests_total',
  help: 'Total HTTP requests handled by the FreightFlow API.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestErrorsTotal = new client.Counter({
  name: 'freightflow_http_request_errors_total',
  help: 'Total HTTP requests that returned a 4xx or 5xx response.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'freightflow_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const authFailuresTotal = new client.Counter({
  name: 'freightflow_auth_failures_total',
  help: 'Authentication and authorization failures.',
  labelNames: ['reason', 'source'],
  registers: [register],
});

const queueJobsTotal = new client.Counter({
  name: 'freightflow_queue_jobs_total',
  help: 'BullMQ job lifecycle counts.',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const queueBacklogGauge = new client.Gauge({
  name: 'freightflow_queue_backlog',
  help: 'BullMQ backlog by queue and job state.',
  labelNames: ['queue', 'state'],
  registers: [register],
});

const cacheOperationsTotal = new client.Counter({
  name: 'freightflow_cache_operations_total',
  help: 'Redis cache lookup outcomes.',
  labelNames: ['operation', 'result'],
  registers: [register],
});

const socketEventsTotal = new client.Counter({
  name: 'freightflow_socket_events_total',
  help: 'Socket.IO connection and event lifecycle counts.',
  labelNames: ['event', 'direction', 'status'],
  registers: [register],
});

const dependencyReadyGauge = new client.Gauge({
  name: 'freightflow_dependency_ready',
  help: 'Dependency readiness status. 1 means ready, 0 means unavailable.',
  labelNames: ['dependency'],
  registers: [register],
});

const normalizeRoute = (req) => {
  if (req.baseUrl && req.route?.path) {
    return `${req.baseUrl}${req.route.path}`.replace(/\/+/g, '/');
  }

  return (req.originalUrl || req.url || 'unknown')
    .split('?')[0]
    .replace(/[a-f\d]{24}/gi, ':id')
    .replace(/\d+/g, ':num');
};

const requestMetricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics' || req.originalUrl === '/api/metrics') {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const labels = {
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);

    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc(labels);
    }
  });

  return next();
};

const recordAuthFailure = (reason, source = 'http') => {
  authFailuresTotal.inc({ reason, source });
};

const recordCacheOperation = (operation, result) => {
  cacheOperationsTotal.inc({ operation, result });
};

const recordQueueJob = (queue, status) => {
  queueJobsTotal.inc({ queue, status });
};

const setQueueBacklog = (queue, counts) => {
  Object.entries(counts).forEach(([state, count]) => {
    queueBacklogGauge.set({ queue, state }, Number(count) || 0);
  });
};

const recordSocketEvent = (event, direction, status = 'ok') => {
  socketEventsTotal.inc({ event, direction, status });
};

const setDependencyReady = (dependency, ready) => {
  dependencyReadyGauge.set({ dependency }, ready ? 1 : 0);
};

const getMetrics = () => register.metrics();

module.exports = {
  getMetrics,
  recordAuthFailure,
  recordCacheOperation,
  recordQueueJob,
  recordSocketEvent,
  requestMetricsMiddleware,
  register,
  setDependencyReady,
  setQueueBacklog,
};
