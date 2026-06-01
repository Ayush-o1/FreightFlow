# FreightFlow — API Reference

Complete reference for all REST API endpoints in the FreightFlow backend.

**Base URL (local):** `http://localhost:5001`

Authentication is cookie-based. The backend sets `ff_access_token` and
`ff_refresh_token` as httpOnly cookies. Browser clients must send requests with
credentials enabled.

Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) require `X-CSRF-Token`.
Bootstrap it with `GET /api/auth/csrf`.

All responses follow this shape:
```json
{
  "success": true | false,
  "message": "...",
  "data": { ... }
}
```

---

## Auth — `/api/auth`

> Login/register are rate limited: 10 requests / 15 minutes / IP.
> Refresh is rate limited separately: 60 requests / 15 minutes / IP.

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

**Response `200`:**
```json
{
  "success": true,
  "data": { "count": 3, "shipments": [ ... ] }
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

---

## Driver — `/api/driver`

### GET `/api/driver/shipments`
**Role:** Driver

Supports optional `?status=assigned|picked_up|in_transit|delivered` query param.

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

Emits `statusUpdated` socket event (and `shipmentDelivered` if delivered) to room `shipment_<id>`.

---

## Admin — `/api/admin`

### GET `/api/admin/analytics`

Returns platform-wide statistics.

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
    "recentShipments": [ ... ]
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

Emits `driverAssigned` socket event to room `shipment_<id>`.

---

### PATCH `/api/admin/shipments/:id/cancel`

Admin can cancel any non-cancelled shipment. Existing shipments are not deleted
or otherwise modified beyond `status` and `statusHistory`.

**Request body:**
```json
{ "note": "Optional cancellation note" }
```

Emits `statusUpdated` socket event to room `shipment_<id>`.

---

### GET `/api/admin/users`

Supports `?role=shipper|driver|admin` query param.

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

Returns only active drivers. Lightweight response: `{ _id, name, email }`.

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

Creates a `Payment` record with `status: "pending"`. One payment per shipment — subsequent calls return the existing record.

---

### POST `/api/payments/confirm/:paymentId`
**Role:** Shipper

**Request body:**
```json
{ "simulate": "success" }
```

Pass `"success"` to mark as paid (generates a mock `transactionId` and sets `paidAt`).
Pass `"failure"` to mark as failed.

Updates the parent shipment's `paymentStatus` field accordingly.

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
  "message": "Descriptive error message here"
}
```
