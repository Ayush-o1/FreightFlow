<div align="center">

# 🚛 FreightFlow

### A full-stack, role-based logistics management SaaS platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](#)
[![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20MongoDB-blue?style=flat-square)](#tech-stack)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#contributing)

FreightFlow connects **shippers** who need cargo delivered with **drivers** who fulfill those deliveries — orchestrated by an **admin** layer that handles assignment, real-time monitoring, and platform analytics.

[Live Demo](#demo) · [API Reference](#api-reference) · [Report Bug](https://github.com/Ayush-o1/FreightFlow/issues) · [Request Feature](https://github.com/Ayush-o1/FreightFlow/issues)

</div>

---

## 📸 Screenshots

| Login | Register |
|---|---|
| ![Login Page](docs/screenshots/login.png) | ![Register Page](docs/screenshots/register.png) |

| 404 Not Found | Access Denied |
|---|---|
| ![Not Found](docs/screenshots/not_found.png) | ![Unauthorized](docs/screenshots/unauthorized.png) |

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [User Roles](#user-roles)
- [Status Flow](#status-flow)
- [API Reference](#api-reference)
- [Real-Time Events](#real-time-events)
- [Authentication](#authentication)
- [Database Models](#database-models)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [Author](#author)

---

## 🌐 Overview

FreightFlow is a production-ready B2B logistics management platform built as a full-stack portfolio project. It demonstrates:

- **REST API design** with JWT auth, role-based access control, input validation, and structured error handling
- **Real-time communication** via Socket.IO — status changes broadcast live to all subscribed clients
- **Responsive React SPA** with three separate role dashboards, skeleton loading, empty states, and toast/bell notification systems
- **Simulated payment layer** — shippers can initiate and confirm payments per shipment
- **Production build pipeline** — Vite with zero warnings and a sub-2-second build time

---

## ✨ Features

### Platform-wide
- ✅ **JWT authentication** — secure token-based sessions with auto-refresh on 401
- ✅ **Role-based access control (RBAC)** — Shipper, Driver, Admin with isolated route guards
- ✅ **Real-time status updates** — Socket.IO per-shipment rooms push live delivery events
- ✅ **Toast notification system** — slide-in toasts for every user action
- ✅ **In-app notification bell** — persistent session history of all socket events
- ✅ **Responsive design** — mobile overlay sidebar, tablet icon-only sidebar, full desktop sidebar
- ✅ **Skeleton loading** on all data-fetching pages
- ✅ **Empty state and error cards** with retry on every list and table

### Shipper
- Create shipment requests with full pickup/delivery details
- Track status through the delivery lifecycle in real time
- Initiate and confirm payments (simulated gateway)
- View full status history timeline on each shipment

### Driver
- View all assigned deliveries on a card-based dashboard
- Advance delivery status inline (assigned → picked up → in transit → delivered)
- Receive live assignment notifications via Socket.IO

### Admin
- Platform-wide analytics dashboard (totals, revenue, recent activity)
- Search, filter, and paginate all shipments
- Assign drivers to pending shipments
- Browse and inspect all registered users

---

## 🛠️ Tech Stack

### Backend (repository root)

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | MongoDB via Mongoose 9 |
| Authentication | JWT (`jsonwebtoken` + `bcryptjs`) |
| Real-time | Socket.IO 4 |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, CSRF cookies, Redis-backed rate limits |
| Distributed infra | Redis, BullMQ, Socket.IO Redis adapter |
| Logging | `pino`, `pino-http` |

### Frontend (`client/`)

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 8 |
| Routing | React Router |
| Styling | Tailwind CSS 4 + CSS custom properties |
| HTTP | Axios (pre-configured instance) |
| Real-time | socket.io-client 4 |
| Icons | lucide-react |

---

## 📁 Project Structure

```
FreightFlow/
├── server.js                 # Entry — HTTP server + Socket.IO boot
├── .env.example              # Environment variable template
├── src/
│   ├── app.js                # Express app, middleware, route mounting
│   ├── config/
│   │   ├── db.js             # MongoDB connection
│   │   └── redis.js          # Redis connection and readiness
│   ├── controllers/          # Route handler logic
│   │   ├── authController.js
│   │   ├── shipmentController.js
│   │   ├── adminController.js
│   │   ├── driverController.js
│   │   └── paymentController.js
│   ├── middlewares/
│   │   ├── auth.js           # protect(), authorizeRoles()
│   │   ├── errorHandler.js   # notFound(), errorHandler()
│   │   └── validateObjectId.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Shipment.js
│   │   ├── Payment.js
│   │   ├── AuditLog.js
│   │   └── OutboxEvent.js
│   ├── queues/               # BullMQ queue definitions
│   ├── jobs/                 # Queue processors
│   ├── workers/              # Worker lifecycle
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── shipmentRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── driverRoutes.js
│   │   └── paymentRoutes.js
│   ├── scripts/
│   │   └── seedAdmin.js      # One-time admin account seeder
│   ├── services/
│   │   ├── socketService.js  # Socket.IO initialization and room management
│   │   ├── outboxService.js  # Durable event persistence
│   │   ├── analyticsService.js # Redis-cached analytics
│   │   └── paymentService.js # Mock transaction ID generator
│   └── utils/
│       ├── responseFormatter.js  # successResponse(), errorResponse()
│       ├── getIO.js              # Socket.IO singleton getter
│       └── httpStatus.js         # HTTP status constants
│
├── client/                       # React SPA
│   ├── public/
│   │   └── favicon.svg
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── api/                  # Axios API helpers (one file per domain)
│       ├── components/
│       │   ├── shared/           # NotificationBell, ToastContainer, PageHeader
│       │   └── ui/               # Badge, Button, Card, Input, Select, Spinner, EmptyState
│       ├── context/              # AuthContext, NotificationContext
│       ├── hooks/                # useAuth, useNotification
│       ├── layouts/              # AuthLayout, DashboardLayout
│       ├── pages/
│       │   ├── admin/            # AdminDashboard, AdminShipments, AdminUsers, AssignDriver
│       │   ├── auth/             # LoginPage, RegisterPage
│       │   ├── driver/           # DriverDashboard, DriverShipments
│       │   ├── shipper/          # ShipperDashboard, ShipmentList, ShipmentDetail, CreateShipment
│       │   ├── NotFound.jsx
│       │   └── NotAuthorized.jsx
│       ├── routes/               # AppRouter, ProtectedRoute
│       ├── socket/               # socketClient singleton, useSocket hooks
│       ├── styles/               # index.css — design tokens + Tailwind
│       └── utils/                # formatters.js (date, currency, status)
│
└── docs/
    ├── API.md                    # Full API reference
    ├── ARCHITECTURE.md           # System design and architectural decisions
    └── screenshots/              # UI screenshots
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MongoDB | Local or [Atlas](https://mongodb.com/atlas) |
| Redis | Local, Docker, or managed Redis |

### Clone

```bash
git clone https://github.com/Ayush-o1/FreightFlow.git
cd FreightFlow
```

---

## ⚙️ Environment Variables

### Backend

```bash
# (run from the repository root)
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5001` |
| `NODE_ENV` | Runtime environment | `development` |
| `MONGODB_URI` / `MONGO_URI` | Full MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/FreightFlow` |
| `JWT_SECRET` | Secret for signing JWTs | *(generate below)* |
| `JWT_REFRESH_SECRET` | Reserved refresh-token secret, validated at startup | *(generate below)* |
| `JWT_EXPIRES_IN` | Short-lived access token expiry | `15m` |
| `ACCESS_TOKEN_COOKIE_MAX_AGE_MS` | Access cookie max age in milliseconds | `900000` |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `COOKIE_SAME_SITE` | Cookie SameSite policy | `strict` locally, `none` for cross-site HTTPS deployments |
| `COOKIE_SECURE` | Require HTTPS cookies | `false` locally, `true` in production |
| `COOKIE_DOMAIN` | Optional shared cookie domain | *(blank locally)* |
| `TRUST_PROXY` | Proxy hop count for hosted deployments | `1` on many PaaS hosts |
| `LOG_LEVEL` | Structured logger level | `info` |
| `LOG_ENABLED` | Disable logs in test automation when set false | `true` |
| `REDIS_URL` | Redis connection string for rate limits, queues, cache, sockets | `redis://localhost:6379` |
| `QUEUE_CONCURRENCY` | BullMQ worker concurrency | `2` |
| `CACHE_TTL` | Analytics cache TTL in seconds | `300` |
| `QUEUE_WORKERS_ENABLED` | Start in-process workers with the API | `true` |
| `ADMIN_EMAIL` | Seed admin email — set your own, never commit | *(your-admin@example.com)* |
| `ADMIN_PASSWORD` | Seed admin password — must be strong, never commit | *(choose a strong password)* |
| `ADMIN_NAME` | Seed admin display name | `Super Admin` |

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ **Never commit your `.env` file.** Both `.env` files are in `.gitignore`.

### Frontend

```bash
cd client
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (no trailing slash) |

---

## ▶️ Running Locally

### 1 — Start the backend

```bash
# (run from the repository root — not a subdirectory)
npm install

# Start Redis locally if you do not already have one
docker run --rm -p 6379:6379 redis:7-alpine

# Create the admin account (run once after setting up .env)
node src/scripts/seedAdmin.js

# Start dev server with hot-reload
npm run dev
# → API running at http://localhost:5001
```

### 2 — Start the frontend

```bash
cd client
npm install
npm run dev
# → App running at http://localhost:5173
```

### 3 — Login with demo credentials

| Role | How to obtain |
|---|---|
| Admin | Seeded via `node src/scripts/seedAdmin.js` using the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values you set in `.env` |
| Shipper | Register via `/register` with role **Shipper** |
| Driver | Register via `/register` with role **Driver** |

> ⚠️ **Never publish admin credentials.** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env` file before seeding.

---

## 👥 User Roles

| Capability | Shipper | Driver | Admin |
|---|:---:|:---:|:---:|
| Register & Login | ✅ | ✅ | Seed only |
| Create shipment | ✅ | ❌ | ❌ |
| View own shipments | ✅ | ❌ | ❌ |
| Cancel shipment | Own pending only | ❌ | Any non-cancelled shipment |
| Initiate / confirm payment | ✅ | ❌ | ❌ |
| View assigned deliveries | ❌ | ✅ | ❌ |
| Update delivery status | ❌ | ✅ | ❌ |
| View all shipments | ❌ | ❌ | ✅ |
| Assign driver to shipment | ❌ | ❌ | ✅ |
| View platform analytics | ❌ | ❌ | ✅ |
| Manage all users | ❌ | ❌ | ✅ |

---

## 🔄 Shipment Status Flow

```
pending  →  assigned  →  picked_up  →  in_transit  →  delivered
```

| Status | Set By | Description |
|---|---|---|
| `pending` | System | Shipment created, awaiting driver assignment |
| `assigned` | Admin | Driver assigned; driver notified in real time |
| `picked_up` | Driver | Cargo collected from pickup location |
| `in_transit` | Driver | Shipment en route to destination |
| `delivered` | Driver | Shipment successfully delivered |
| `cancelled` | Shipper/Admin | Shipper can cancel own pending shipments; admin can cancel any non-cancelled shipment |

> Status transitions are **forward-only** and **strictly enforced** on the backend.

---

## 📡 API Reference

### Base URL

```
http://localhost:5001/api
```

### Health And Readiness

```
GET /api/live
GET /api/ready
GET /api/health
```

`/api/live` reports process liveness. `/api/ready` verifies MongoDB and Redis
connectivity. `/api/health` returns a summary with `live`, `ready`, `version`,
uptime, and dependency state.

### Authentication  `/api/auth`

> Rate limited: 10 requests / 15 minutes per IP

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/csrf` | No | Issue CSRF token for unsafe requests |
| `POST` | `/auth/register` | No | Register a new user (shipper or driver) |
| `POST` | `/auth/login` | No | Login and set httpOnly auth cookies |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token and issue fresh cookies |
| `POST` | `/auth/logout` | Cookie | Invalidate refresh token and clear auth cookies |
| `GET` | `/auth/me` | Yes | Get current user profile |

**Register body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "shipper"
}
```

### Shipments  `/api/shipments`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/shipments` | Shipper | Create a shipment |
| `GET` | `/shipments/my` | Shipper | List own shipments |
| `GET` | `/shipments/:id` | All | Get single shipment |
| `PATCH` | `/shipments/:id/cancel` | Shipper | Cancel own pending shipment |

### Driver  `/api/driver`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/driver/shipments` | List assigned shipments |
| `PATCH` | `/driver/shipments/:id/status` | Advance delivery status |

**Status update body:**
```json
{ "status": "picked_up", "note": "Picked up at 10:30 AM" }
```

### Admin  `/api/admin`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/analytics` | Platform-wide stats and revenue |
| `GET` | `/admin/shipments` | All shipments (`?status=`, `?search=`, `?page=`, `?limit=`) |
| `PATCH` | `/admin/shipments/:id/assign` | Assign a driver |
| `PATCH` | `/admin/shipments/:id/cancel` | Cancel any non-cancelled shipment |
| `GET` | `/admin/users` | All users (`?role=shipper\|driver\|admin`) |
| `PATCH` | `/admin/users/:id/status` | Activate or deactivate a user account |
| `GET` | `/admin/drivers` | Active drivers (lightweight dropdown list) |

### Payments  `/api/payments`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payments/initiate/:shipmentId` | Create a pending payment record |
| `POST` | `/payments/confirm/:paymentId` | Simulate payment success or failure |
| `GET` | `/payments/:shipmentId` | Get payment record for a shipment |

Critical mutation endpoints require `Idempotency-Key`:

- `PATCH /shipments/:id/cancel`
- `PATCH /driver/shipments/:id/status`
- `PATCH /admin/shipments/:id/assign`
- `PATCH /admin/shipments/:id/cancel`
- `POST /payments/confirm/:paymentId`

> 📄 Full API reference with request/response examples: **[docs/API.md](docs/API.md)**

---

## ⚡ Real-Time Events (Socket.IO)

Clients join a shipment-specific room to receive live updates.
Room joins are authorized server-side. Only the shipment owner, assigned driver,
or an admin can subscribe to a shipment room.

### Client → Server

| Event | Payload |
|---|---|
| `joinShipmentRoom` | `{ shipmentId }` |
| `leaveShipmentRoom` | `{ shipmentId }` |

### Server → Client

| Event | Payload | Triggered When |
|---|---|---|
| `statusUpdated` | `{ shipmentId, newStatus, updatedBy, role, note, timestamp }` | Driver advances status |
| `shipmentDelivered` | `{ shipmentId, message, timestamp }` | Status reaches `delivered` |
| `driverAssigned` | `{ shipmentId, driverId, driverName, status, message, timestamp }` | Admin assigns a driver |

Socket.IO uses the Redis adapter so shipment-room events propagate across
multiple API instances.

---

## 🔐 Authentication

1. The SPA calls `GET /api/auth/csrf` and sends `X-CSRF-Token` on unsafe requests.
2. Login/register set short-lived `ff_access_token` and rotating `ff_refresh_token` httpOnly cookies.
3. The frontend does not store JWTs in `localStorage`.
4. `protect` reads the access cookie, verifies the JWT, confirms the user is active, and attaches `req.user`.
5. `authorizeRoles(...roles)` checks `req.user.role` against allowed roles.
6. On access-token expiry, Axios calls `POST /api/auth/refresh`; the refresh token is rotated and stored as a SHA-256 hash in MongoDB.
7. Admin accounts can only be created via `node src/scripts/seedAdmin.js`.

---

## ⚙️ Distributed Operations

- Redis stores rate-limit counters, idempotency records, analytics cache entries,
  BullMQ queues, and Socket.IO pub/sub state.
- BullMQ queues handle notifications, audit writes, outbox publishing, future
  payment jobs, and recovery sweeps.
- Shipment assignment, cancellation, delivery updates, user status changes, and
  payment confirmations write durable outbox/audit records before async work runs.
- Recovery jobs re-enqueue pending outbox events, retry failed audit/notification
  jobs, and report stale shipments or stuck payments.
- Admin analytics are cached in Redis for 5 minutes and invalidated after shipment,
  payment, and user-status mutations.

## ✅ Testing And Coverage

### Backend

```bash
npm run check          # node --check syntax validation
npm test               # Jest + Supertest integration tests
npm run test:coverage  # Coverage report in coverage/
```

The backend test harness uses `mongodb-memory-server` with `MongoMemoryReplSet`,
so payment transaction tests run against a transaction-capable MongoDB replica set.
Redis must be available at `REDIS_URL`; CI provides a Redis service container.
Coverage gates enforce at least 80% global statement coverage, 70% branch
coverage, and 85%+ statement coverage on auth-critical modules.

### Frontend

```bash
cd client
npm run lint
npm run build
npm test
npm run test:coverage
```

Frontend tests use Vitest, React Testing Library, and jsdom. Critical coverage
focuses on auth hydration, protected route behavior, CSRF headers, and refresh retry logic.

---

## 🧭 Observability And Audit Logging

- Every HTTP request receives an `X-Request-ID` response header.
- Error responses include `requestId` for correlation.
- API logs use structured `pino` / `pino-http` output.
- Sensitive values such as cookies, Authorization headers, passwords, JWTs, and refresh hashes are redacted.
- Audit events are queued through BullMQ and never block user requests.

Audited events:

| Area | Events |
|---|---|
| Auth | login, logout, refresh failures |
| Admin | activate user, deactivate user |
| Shipments | assignment, cancellation |
| Payments | confirmation |

---

## 🔁 CI/CD

GitHub Actions runs on pushes and pull requests to `main`.

Backend CI:
- install
- Redis service container
- syntax checks
- tests
- coverage
- production audit

Frontend CI:
- install
- lint
- build
- tests
- coverage
- production audit

Platform CI also validates Docker builds, scans container images, scans for
secrets, validates Kubernetes manifests, and validates Terraform. Optional
deployment is behind a manual production environment gate.

CodeQL and Dependabot are configured for security scanning and dependency updates.

---

## ☁️ Cloud-Native Operations

Phase 7 platform assets:

| Area | Path |
|---|---|
| Backend container | `Dockerfile` |
| Frontend Nginx container | `client/Dockerfile`, `client/nginx.conf` |
| Compose stacks | `docker-compose.yml`, `docker-compose.prod.yml` |
| Kubernetes manifests | `k8s/` |
| Terraform foundation | `infra/terraform/` |
| Prometheus rules/config | `monitoring/prometheus/` |
| Grafana dashboards | `monitoring/grafana/dashboards/` |
| Backup/restore | `scripts/backup/` |
| Load tests | `load-tests/` |
| Runbooks | `runbooks/` |

Prometheus metrics are exposed at `/api/metrics`. Health endpoints remain
`/api/live`, `/api/ready`, and `/api/health`.

Operational docs:

- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS.md`
- `docs/DISASTER_RECOVERY.md`

---

## 🗄️ Database Models

### User
```
name · email · password (hashed) · role · isActive · timestamps
```

### Shipment
```
shipper (ref) · driver (ref) · pickupLocation · deliveryLocation
goodsType · weight · description · status · statusHistory[]
paymentStatus · estimatedDelivery · trackingNumber · timestamps
```

### Payment
```
shipment (ref) · shipper (ref) · amount · status · paymentMethod
transactionId · paidAt · timestamps
```

---

## 🔮 Future Improvements

| Feature | Priority |
|---|---|
| Email notifications (SendGrid) on status changes | High |
| Google Maps integration for real-time route tracking | High |
| Push notifications (PWA / web-push) | Medium |
| Shipment document uploads (invoices, POD) | Medium |
| Driver mobile app (React Native) | Medium |
| Multi-currency payment support | Low |
| Advanced analytics with charts (recharts) | Low |
| Admin reports export (CSV / PDF) | Low |
| Rate negotiation between shippers and drivers | Low |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork** the repository
2. **Create** your feature branch: `git checkout -b feat/amazing-feature`
3. **Commit** with a meaningful message: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feat/amazing-feature`
5. **Open** a Pull Request against `main`

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    Formatting (no logic changes)
refactor: Code refactoring
perf:     Performance improvement
test:     Adding or updating tests
chore:    Build, CI, or tooling changes
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👤 Author

**Ayush Kumar**

[![GitHub](https://img.shields.io/badge/GitHub-Ayush--o1-181717?style=flat-square&logo=github)](https://github.com/Ayush-o1)

---

<div align="center">

*Built as a full-stack portfolio project demonstrating REST API design, real-time communication, role-based access control, and modern React application architecture.*

⭐ **If you found this useful, please star the repository!**

</div>
