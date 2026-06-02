'use strict';

const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require('@opentelemetry/semantic-conventions');
const pkg = require('../../package.json');

let sdk = null;

const isTracingEnabled = () => {
  if (process.env.OTEL_ENABLED === 'false') return false;
  if (process.env.NODE_ENV === 'test' && process.env.OTEL_ENABLED !== 'true') return false;
  return true;
};

const getTraceExporter = () => {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`
      : null);

  if (!endpoint) return undefined;
  return new OTLPTraceExporter({ url: endpoint });
};

const initTracing = () => {
  if (sdk || !isTracingEnabled()) return sdk;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'freightflow-api',
      [ATTR_SERVICE_VERSION]: pkg.version,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
    }),
    traceExporter: getTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
  return sdk;
};

const shutdownTracing = async () => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
};

const getTracer = () => trace.getTracer('freightflow-platform');

const runWithSpan = async (name, attributes, operation) => {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
};

module.exports = {
  getTracer,
  initTracing,
  runWithSpan,
  shutdownTracing,
};
