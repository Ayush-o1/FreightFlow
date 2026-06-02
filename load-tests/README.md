# FreightFlow Load Tests

These k6 scripts provide baseline production-operation scenarios.

```bash
k6 run load-tests/auth.js
k6 run load-tests/shipments.js
k6 run load-tests/admin-dashboard.js
k6 run load-tests/socket-traffic.js
```

Common environment variables:

- `BASE_URL` defaults to `http://localhost:5001`
- `SHIPPER_EMAIL`, `SHIPPER_PASSWORD`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `DRIVER_EMAIL`, `DRIVER_PASSWORD`
- `SHIPMENT_ID` for detail/status scenarios

For CI or local machines without k6 installed:

```bash
docker run --rm -i -v "$PWD:/work" -w /work grafana/k6 run load-tests/auth.js
```
