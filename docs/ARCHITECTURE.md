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

## Observability

FreightFlow now uses structured backend logging with `pino` and `pino-http`.

Request flow:

1. `requestId` middleware accepts an incoming `X-Request-ID` or generates a UUID.
2. The same request ID is written to `res.locals`, added to the `X-Request-ID`
   response header, and included in structured request/error logs.
3. Error responses include `requestId`, so client-visible failures can be matched
   to server logs.

Sensitive values are redacted from logs:

- `Authorization` headers
- Cookie headers
- Passwords
- JWT/access token fields
- Refresh token/hash fields

## Audit Logging

`AuditLog` records sensitive security and business actions without blocking the
main request path. Controllers call `recordAuditEvent(...)`, which writes in the
background and logs audit-write failures instead of failing user requests.

Audited areas:

| Area | Events |
|------|--------|
| Auth | login, logout, refresh failures |
| Admin | user activation/deactivation |
| Shipments | assignment, cancellation |
| Payments | confirmation |

## Health And Readiness

Health routes are mounted under `/api`:

| Endpoint | Purpose |
|----------|---------|
| `/api/live` | Process liveness only |
| `/api/ready` | Dependency readiness, currently MongoDB connection state |
| `/api/health` | Summary with live, ready, version, uptime, and dependencies |

Readiness returns `503` if MongoDB is disconnected. This lets production
platforms separate process health from dependency availability.

## Testing Architecture

Backend tests use Jest and Supertest. Integration tests run against
`MongoMemoryReplSet`, not a standalone in-memory MongoDB, because payment
controllers use MongoDB transactions.

Coverage focuses on:

- Auth cookies and refresh rotation
- CSRF protection
- RBAC and inactive-user rejection
- Shipment lifecycle rules
- Payment transaction integrity
- Socket authentication and shipment-room authorization
- Health/readiness and request ID correlation

Frontend tests use Vitest, React Testing Library, and jsdom. Critical frontend
coverage targets AuthContext hydration, ProtectedRoute behavior, and Axios
CSRF/refresh interceptors.

## CI/CD

GitHub Actions validates every push and pull request to `main`.

Backend CI runs dependency installation, syntax checks, Jest tests, coverage,
and production dependency audit. Frontend CI runs dependency installation, lint,
Vite build, Vitest tests, coverage, and production dependency audit.

CodeQL scans JavaScript security issues, and Dependabot monitors backend,
frontend, and GitHub Actions dependencies.

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
