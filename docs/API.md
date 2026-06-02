# FreightFlow — API Reference

Complete reference for all REST API endpoints in the FreightFlow backend.

**Base URL (local):** `http://localhost:5001`

Every response includes an `X-Request-ID` header. Error responses include the
same `requestId` in the JSON body so logs and client reports can be correlated.

Authentication is cookie-based. The backend sets `ff_access_token` and
`ff_refresh_token` as httpOnly cookies. Browser clients must send requests with
credentials enabled.

Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) require `X-CSRF-Token`.
Bootstrap it with `GET /api/auth/csrf`.

Critical mutation endpoints also require `Idempotency-Key`. Reusing the same key
for the same authenticated user and endpoint returns the original successful
response with `Idempotency-Replayed: true` instead of repeating the side effect.

All responses follow this shape:
```json
{
  "success": true | false,
  "message": "...",
  "data": { ... }
}
```

---

## Health — `/api`

### GET `/api/live`

Process liveness endpoint. Does not check dependencies.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "live": true,
    "environment": "production",
    "uptimeSeconds": 123,
    "timestamp": "2026-06-01T00:00:00.000Z"
  }
}
```

### GET `/api/ready`

Readiness endpoint. Verifies MongoDB and Redis connection state.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "ready": true,
    "dependencies": {
      "mongo": { "ready": true, "state": 1, "stateLabel": "connected" },
      "redis": { "ready": true, "state": "ready", "urlConfigured": true }
    }
  }
}
```

Returns `503` if MongoDB or Redis is not connected.

### GET `/api/health`

Summary endpoint containing liveness, readiness, version, uptime, and dependency state.

### GET `/api/metrics`

Prometheus scrape endpoint. Exposes process metrics, HTTP request counts,
request latency histograms, auth failure counts, cache hit/miss counters,
BullMQ job lifecycle counters, queue backlog gauges, dependency readiness, and
Socket.IO event counters.

Key metric names:

| Metric | Meaning |
|--------|---------|
| `freightflow_http_requests_total` | API request count by method, route, status |
| `freightflow_http_request_errors_total` | API 4xx/5xx count |
| `freightflow_http_request_duration_seconds` | API latency histogram |
| `freightflow_auth_failures_total` | Auth/authz failure count |
| `freightflow_dependency_ready` | MongoDB and Redis readiness gauge |
| `freightflow_queue_jobs_total` | BullMQ job lifecycle count |
| `freightflow_queue_backlog` | BullMQ backlog by queue and state |
| `freightflow_cache_operations_total` | Redis cache hit/miss count |
| `freightflow_socket_events_total` | Socket.IO lifecycle and event count |

---

## Auth — `/api/auth`

> Login/register are rate limited: 10 requests / 15 minutes / IP.
> Refresh is rate limited separately: 60 requests / 15 minutes / IP.
> Rate-limit counters are stored in Redis so limits are shared across instances.

### GET `/api/auth/csrf`

Issues a CSRF token cookie and returns the same token for the SPA to send in the
`X-CSRF-Token` header.

**Response `200`:**
```json
{
  "success": true,
  "data": { "csrfToken": "<token>" }
}
```

### POST `/api/auth/register`

Register a new shipper or driver. Admin accounts must be created via the seed script.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "shipper"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Max 100 chars |
| `email` | string | Yes | Must be a valid email |
| `password` | string | Yes | 8-128 chars |
| `role` | string | No | `"shipper"` or `"driver"` — defaults to `"shipper"` |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "Jane Doe", "email": "...", "role": "shipper" }
  }
}
```

---

### POST `/api/auth/login`

**Request body:**
```json
{
  "email": "jane@example.com",
  "password": "securepassword"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "...", "email": "...", "role": "..." }
  }
}
```

---

### POST `/api/auth/refresh`

Reads `ff_refresh_token`, verifies its SHA-256 hash in MongoDB, rotates the
refresh token, and sets fresh auth cookies.

---

### POST `/api/auth/logout`

Requires a valid access cookie. Clears the stored refresh token hash and auth
cookies.

---

### GET `/api/auth/me`

Returns the currently authenticated user's profile.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "...", "email": "...", "role": "...", "isActive": true }
  }
}
```

---

## Shipments — `/api/shipments`

### POST `/api/shipments`
**Role:** Shipper

**Request body:**
```json
{
  "pickupLocation": {
    "address": "12 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001"
  },
  "deliveryLocation": {
    "address": "45 Park Street",
    "city": "Kolkata",
    "state": "West Bengal",
    "pincode": "700016"
  },
  "goodsType": "Electronics",
  "weight": 120,
  "description": "Fragile",
  "estimatedDelivery": "2025-06-15T00:00:00.000Z"
}
```

**Response `201`:** Created shipment object with `status: "pending"`.

---

### GET `/api/shipments/my`
**Role:** Shipper

Returns all shipments created by the authenticated shipper.
Supports `?status=`, `?page=`, and `?limit=`.

**Response `200`:**
```json
{
  "success": true,
  "data": { "total": 3, "page": 1, "limit": 10, "totalPages": 1, "count": 3, "shipments": [ ... ] }
}
```

---

### GET `/api/shipments/:id`
**Role:** Shipper / Driver / Admin

Returns a single shipment with full `statusHistory` array.

---

### PATCH `/api/shipments/:id/cancel`
**Role:** Shipper

Cancels the authenticated shipper's own shipment only when its current status is
`pending`.

**Request body:**
```json
{ "note": "Optional cancellation note" }
```

Requires `Idempotency-Key`.

---

## Driver — `/api/driver`

### GET `/api/driver/shipments`
**Role:** Driver

Supports optional `?status=assigned|picked_up|in_transit|delivered` query param.
Also supports `?page=` and `?limit=`.

---

### PATCH `/api/driver/shipments/:id/status`
**Role:** Driver

**Request body:**
```json
{
  "status": "picked_up",
  "note": "Collected from warehouse at 10:30 AM"
}
```

Valid status progression: `assigned` → `picked_up` → `in_transit` → `delivered`

Requires `Idempotency-Key`. The state change is atomic and conditionally updates
only if the shipment is still in the expected previous status.

Persists an outbox event that emits `statusUpdated` socket event (and
`shipmentDelivered` if delivered) to room `shipment_<id>`.

---

## Admin — `/api/admin`

### GET `/api/admin/analytics`

Returns platform-wide statistics.
The response is cached in Redis for `CACHE_TTL` seconds.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalShipments": 42,
    "shipmentsByStatus": {
      "pending": 10, "assigned": 8, "picked_up": 5,
      "in_transit": 7, "delivered": 11, "cancelled": 1
    },
    "totalShippers": 15,
    "totalDrivers": 8,
    "totalRevenue": 125000,
    "recentShipments": [ ... ],
    "cache": "miss"
  }
}
```

---

### GET `/api/admin/shipments`

Query params:
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status value |
| `search` | string | Search shipper name, driver name, goods type |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10) |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "total": 42, "page": 1, "totalPages": 5, "count": 10,
    "shipments": [ ... ]
  }
}
```

---

### PATCH `/api/admin/shipments/:id/assign`

**Request body:**
```json
{ "driverId": "<driver_user_id>" }
```

Validates: shipment must be `pending`, driver must be `active` with `role = driver`.

Requires `Idempotency-Key`. The assignment is an atomic conditional update and
persists an outbox event that emits `driverAssigned` to room `shipment_<id>`.

---

### PATCH `/api/admin/shipments/:id/cancel`

Admin can cancel any non-cancelled shipment. Existing shipments are not deleted
or otherwise modified beyond `status` and `statusHistory`.

**Request body:**
```json
{ "note": "Optional cancellation note" }
```

Requires `Idempotency-Key`. Persists an outbox event that emits `statusUpdated`
to room `shipment_<id>`.

---

### GET `/api/admin/users`

Supports `?role=shipper|driver|admin`, `?page=`, and `?limit=` query params.

---

### PATCH `/api/admin/users/:id/status`

Activates or deactivates a user account. Deactivation invalidates the user's
stored refresh token but does not auto-cancel shipments.

**Request body:**
```json
{ "isActive": false }
```

---

### GET `/api/admin/drivers`

Returns only active drivers. Supports `?page=` and `?limit=`. Lightweight
response: `{ _id, name, email }`.

---

## Payments — `/api/payments`

### POST `/api/payments/initiate/:shipmentId`
**Role:** Shipper

**Request body:**
```json
{
  "amount": 4500,
  "paymentMethod": "card"
}
```

`paymentMethod`: `"card"` | `"upi"` | `"netbanking"`

Creates a `Payment` record with `status: "pending"`. One payment per shipment — subsequent calls return `409 Conflict`.

---

### POST `/api/payments/confirm/:paymentId`
**Role:** Shipper

**Request body:**
```json
{ "simulate": "success" }
```

Pass `"success"` to mark as paid (generates a mock `transactionId` and sets `paidAt`).
Pass `"failure"` to mark as failed.

Requires `Idempotency-Key`. Updates the parent shipment's `paymentStatus` field
inside the same MongoDB transaction and prevents double confirmation.

---

### GET `/api/payments/:shipmentId`
**Role:** Shipper / Admin

Returns the payment record for a given shipment. Returns `404` if no payment has been initiated.

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation error |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient role |
| 403 | CSRF validation failed — missing or stale `X-CSRF-Token` |
| 404 | Resource not found |
| 409 | Conflict — e.g. duplicate payment |
| 429 | Too many requests (auth rate limit) |
| 500 | Internal server error |

Error body:
```json
{
  "success": false,
  "message": "Descriptive error message here",
  "requestId": "7e3b2fd8-6c49-4dd2-a6e8-d084dfe6a51a"
}
```

---

## Audit Logging

The API writes non-blocking audit records for sensitive business events:

| Event | Trigger |
|-------|---------|
| `auth.login` | Login/register creates an authenticated session |
| `auth.logout` | Logout invalidates the session |
| `auth.refresh_failed` | Missing, invalid, expired, or inactive refresh attempt |
| `shipment.assigned` | Admin assigns a driver |
| `shipment.cancelled` | Shipper/admin cancels a shipment |
| `admin.user_activated` | Admin reactivates a user |
| `admin.user_deactivated` | Admin deactivates a user |
| `payment.confirmed` | Payment confirmation succeeds or fails |

Audit logging is failure-safe and queue-backed: controllers enqueue audit jobs,
BullMQ retries failures, and failed audit writes do not break user requests.

## Outbox, Queues, And Recovery

Shipment assignment, cancellation, driver status updates, user activation,
user deactivation, and shipment creation persist `OutboxEvent` records. The
outbox worker publishes socket events and notification jobs asynchronously.

Operational queues:

| Queue | Purpose |
|-------|---------|
| `notificationQueue` | Async notification delivery |
| `auditQueue` | Async audit writes |
| `outboxQueue` | Durable event publication |
| `futurePaymentQueue` | Reserved payment follow-up work |
| `recoveryQueue` | Scheduled recovery sweeps |

Recovery sweeps re-enqueue pending outbox records, retry failed audit and
notification jobs, and report stuck payments or stale shipments.
