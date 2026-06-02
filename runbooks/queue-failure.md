# Runbook: Queue Failure

## Signals

- `FreightFlowQueueBacklog` alert fires.
- `freightflow_queue_backlog` grows for `auditQueue`, `outboxQueue`, or `notificationQueue`.
- Socket or notification side effects lag behind shipment mutations.

## Triage

```bash
kubectl -n freightflow logs deploy/backend --tail=200 | grep -i queue
curl -fsS https://freightflow.example.com/api/metrics | grep freightflow_queue
```

## Recovery

1. Confirm Redis readiness.
2. Confirm backend workers are enabled with `QUEUE_WORKERS_ENABLED=true`.
3. Restart backend pods to recreate BullMQ workers.
4. Let the recovery sweep re-enqueue failed outbox and notification jobs.
5. If backlog remains high, scale backend replicas or increase `QUEUE_CONCURRENCY`.
