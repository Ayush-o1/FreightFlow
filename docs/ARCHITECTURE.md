# FreightFlow — Architecture

This document describes the architectural decisions behind FreightFlow.

---

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                        CLIENT                            │
│         React 18 + Vite + Tailwind CSS v4                │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│   │  Shipper │  │  Driver  │  │        Admin         │  │
│   │  Pages   │  │  Pages   │  │        Pages         │  │
│   └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│        │             │                    │              │
│   ┌────▼─────────────▼────────────────────▼───────────┐  │
│   │          Axios (httpOnly cookies + CSRF header)    │  │
│   │          Socket.io-client (per-shipment rooms)     │  │
│   └────────────────────────┬──────────────────────────┘  │
└───────────────────────────-│──────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼──────────────────────────────┐
│                        BACKEND                             │
│              Node.js + Express + Socket.io                 │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  /auth   │  │/shipments│  │ /driver  │  │  /admin  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │             │              │        │
│  ┌────▼─────────────▼─────────────▼──────────────▼─────┐  │
│  │             Controllers + Middleware                  │  │
│  │     protect → authorizeRoles → controller handler    │  │
│  └────────────────────────┬──────────────────────────── ┘  │
│                           │                               │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │                     Mongoose ODM                       │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────│───────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────┐
│                       MongoDB Atlas                        │
│              Collections: users, shipments, payments       │
└───────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Layered Structure

The backend follows a standard layered pattern:

```
HTTP Request
    ↓
Express Router (route-level validation)
    ↓
Middleware (protect → authorizeRoles → validateObjectId)
    ↓
Controller (business logic, DB queries)
    ↓
Mongoose Model (schema validation, hooks)
    ↓
MongoDB
```

### Request/Response Format

All responses use a consistent envelope via `responseFormatter.js`:

```js
// Success
{ success: true, message: "...", data: { ... } }

// Error
{ success: false, message: "..." }
```

This makes client-side parsing predictable.

---

## Authentication

Cookie-based JWT authentication:

1. The SPA bootstraps a CSRF token with `GET /api/auth/csrf`
2. Login/register set `ff_access_token` and `ff_refresh_token` as httpOnly cookies
3. The refresh token is a high-entropy random value; MongoDB stores only its SHA-256 hash
4. All protected routes use the `protect` middleware which:
   - Extracts the access token from the cookie, with Bearer header fallback for API clients
   - Verifies the JWT signature and expiry
   - Confirms the user still exists and `isActive = true` in the database
   - Attaches the full user document to `req.user`
5. Axios automatically calls `POST /api/auth/refresh` on 401 responses and retries once
6. `authorizeRoles(...roles)` then guards each route for specific roles

Admin accounts cannot be self-registered. They are created via `seedAdmin.js`.

---

## Real-Time Layer (Socket.io)

Socket.io is attached to the same HTTP server as Express.

**Room strategy:** One room per shipment — `shipment_<shipmentId>`

- Clients call `joinShipmentRoom({ shipmentId })` to subscribe
- The server authorizes every room join: only the shipment owner, assigned driver, or admin can join
- When status or assignment changes, the controller retrieves the `io` singleton via `getIO()` and emits to the room
- No global broadcasts — events are scoped to the relevant shipment

**Events emitted by the server:**

| Event | Emitted by |
|-------|-----------|
| `statusUpdated` | `driverController.updateShipmentStatus` |
| `shipmentDelivered` | `driverController.updateShipmentStatus` (when delivered) |
| `driverAssigned` | `adminController.assignDriver` |

---

## Security Measures

| Concern | Implementation |
|---------|---------------|
| Injection | Mongoose schema types + express-validator + express-mongo-sanitize |
| XSS | Helmet sets `Content-Security-Policy` and other protective headers |
| CSRF | Double-submit CSRF token required for unsafe cookie-auth requests |
| Auth bypass | JWT verified on every protected request + active user check |
| Brute force | express-rate-limit on auth and business route groups |
| CORS | Origin whitelist via `CLIENT_URL` env variable |
| Password storage | bcryptjs with 12 salt rounds |
| Secret exposure | `.env` excluded from git; no secrets in code or docs |

---

## Data Relationships

```
User (shipper) ──creates──▶ Shipment ◀──is assigned── User (driver)
                                │
                                └──has──▶ Payment
                                └──has──▶ StatusHistory[]
```

- One shipment can have at most one payment (unique index on `Payment.shipment`)
- `statusHistory` is an embedded array on each Shipment document — no separate collection
- `driver` is null on a shipment until an admin assigns one

---

## Frontend Architecture

### State Management

No external state management library is used. State is handled via:

- **React Context** — `AuthContext` (user, login, logout) and `NotificationContext` (bell history, toasts)
- **Local component state** — page-level `useState` for data fetching results
- **URL state** — `useSearchParams` for shipment filtering and assignment query params

### API Layer

Each domain has a dedicated API module in `src/api/`:

```
axiosInstance.js     — shared Axios instance with credentials, CSRF, and refresh retry
adminApi.js          — admin endpoints
shipmentApi.js       — shipper + shared shipment endpoints
driverApi.js         — driver endpoints
paymentApi.js        — payment endpoints
```

The `axiosInstance` sends cookies with every request, attaches `X-CSRF-Token`
for unsafe methods, and performs a queued refresh/retry flow on 401 responses.

### Routing

`AppRouter.jsx` defines all routes. `ProtectedRoute.jsx` wraps each role-specific route and redirects unauthenticated or wrong-role users to the appropriate page.

### Real-Time Integration

`socketClient.js` creates a single socket.io-client instance with `autoConnect: false`. The `useSocketConnection()` hook (called in `DashboardLayout`) connects the socket when a user is authenticated and disconnects it on logout. Individual pages use `useSocketEvent(eventName, handler)` to subscribe to events with automatic cleanup on unmount.
