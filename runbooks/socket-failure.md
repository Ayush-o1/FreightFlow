# Runbook: Socket Failure

## Signals

- Users do not receive shipment status updates in real time.
- `freightflow_socket_events_total` stops increasing.
- Browser console shows Socket.IO connection or CORS errors.

## Triage

```bash
kubectl -n freightflow logs deploy/backend --tail=200 | grep -i socket
curl -fsS https://freightflow.example.com/api/health
```

Check:

- `CLIENT_URL` matches the frontend origin.
- Ingress routes `/socket.io` to the backend service.
- Redis adapter is connected.
- Auth cookies are present and valid.

## Recovery

1. Fix ingress/CORS/cookie configuration if needed.
2. Restore Redis if adapter pub/sub is failing.
3. Restart backend pods.
4. Validate a room join from the browser and confirm `joinShipmentRoom` metrics increase.
