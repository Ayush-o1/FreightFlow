# FreightFlow Operations

## Runtime Checks

| Check | Endpoint / Command |
|---|---|
| Liveness | `GET /api/live` |
| Readiness | `GET /api/ready` |
| Health summary | `GET /api/health` |
| Prometheus metrics | `GET /api/metrics` |
| Security headers | `TARGET_URL=https://.../api/live npm run security:headers` |

## Metrics

Core metrics:

- `freightflow_http_requests_total`
- `freightflow_http_request_errors_total`
- `freightflow_http_request_duration_seconds`
- `freightflow_auth_failures_total`
- `freightflow_dependency_ready`
- `freightflow_queue_jobs_total`
- `freightflow_queue_backlog`
- `freightflow_cache_operations_total`
- `freightflow_socket_events_total`

Prometheus config and alerts live under `monitoring/prometheus/`. Grafana
dashboard exports live under `monitoring/grafana/dashboards/`.

## Tracing

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to an OpenTelemetry collector endpoint such as
`http://otel-collector.observability:4318`. The backend exports spans for HTTP,
MongoDB, Redis, queue processing, and Socket.IO paths.

## Runbooks

Use the runbooks in `runbooks/` for deployment failure, Redis outage, MongoDB
outage, queue failure, socket failure, and rollback.
