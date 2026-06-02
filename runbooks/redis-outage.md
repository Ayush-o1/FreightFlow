# Runbook: Redis Outage

## Impact

Redis powers rate limits, cache, BullMQ queues, idempotency, and Socket.IO
cross-instance delivery. API readiness fails while Redis is unavailable.

## Triage

```bash
kubectl -n freightflow get pods -l app.kubernetes.io/name=redis
kubectl -n freightflow logs deploy/redis --tail=100
kubectl -n freightflow exec deploy/redis -- redis-cli ping
```

## Recovery

1. Restore Redis service or managed Redis endpoint.
2. Confirm `/api/ready` reports Redis ready.
3. Watch queue backlog:

```bash
curl -fsS https://freightflow.example.com/api/metrics | grep freightflow_queue_backlog
```

4. If queues are stale, restart backend workers by rolling the backend deployment.
