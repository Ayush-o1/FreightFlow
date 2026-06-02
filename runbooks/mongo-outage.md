# Runbook: MongoDB Outage

## Impact

MongoDB stores users, shipments, payments, audit logs, and outbox events. The API
is not ready while MongoDB is unavailable.

## Triage

```bash
kubectl -n freightflow get pods -l app.kubernetes.io/name=mongodb
kubectl -n freightflow logs statefulset/mongodb --tail=100
kubectl -n freightflow exec statefulset/mongodb -- mongosh --eval "db.adminCommand('ping')"
```

## Recovery

1. Restore MongoDB service or managed cluster.
2. Confirm `/api/ready`.
3. Check outbox recovery logs to confirm pending events were re-enqueued.
4. If data is corrupted, follow `docs/DISASTER_RECOVERY.md`.
