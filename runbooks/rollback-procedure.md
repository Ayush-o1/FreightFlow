# Runbook: Rollback Procedure

## Kubernetes

```bash
kubectl -n freightflow rollout history deploy/backend
kubectl -n freightflow rollout undo deploy/backend
kubectl -n freightflow rollout status deploy/backend

kubectl -n freightflow rollout history deploy/frontend
kubectl -n freightflow rollout undo deploy/frontend
kubectl -n freightflow rollout status deploy/frontend
```

## Docker Compose

```bash
BACKEND_IMAGE=ghcr.io/ayush-o1/freightflow-backend:<previous-sha> \
FRONTEND_IMAGE=ghcr.io/ayush-o1/freightflow-frontend:<previous-sha> \
docker compose -f docker-compose.prod.yml up -d
```

## Verification

1. `/api/live`
2. `/api/ready`
3. `/api/metrics`
4. Login and refresh flow
5. Shipment list
6. Socket room join
7. Queue backlog returns to normal
