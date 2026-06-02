# Runbook: Deployment Failure

## Signals

- Kubernetes rollout does not complete.
- `/api/live` succeeds but `/api/ready` fails.
- New pods restart or fail startup probes.

## Triage

```bash
kubectl -n freightflow rollout status deploy/backend
kubectl -n freightflow get pods
kubectl -n freightflow describe pod -l app.kubernetes.io/name=freightflow-backend
kubectl -n freightflow logs deploy/backend --tail=100
```

## Recovery

1. Verify secrets and config map values.
2. Check MongoDB and Redis readiness.
3. Roll back if the new image is unhealthy:

```bash
kubectl -n freightflow rollout undo deploy/backend
kubectl -n freightflow rollout undo deploy/frontend
```

4. Confirm `/api/ready`, `/api/metrics`, login, and shipment list.
