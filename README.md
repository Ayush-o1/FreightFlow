# FreightFlow

**A role-based logistics SaaS platform for managing freight shipments end-to-end.**

FreightFlow connects shippers who need cargo delivered with drivers who fulfill those deliveries — coordinated by an admin layer that handles assignment, monitoring, and analytics. Built as a full-stack application with a Node.js/Express REST API backend and a React frontend.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Real-Time Events (Socket.io)](#real-time-events-socketio)
- [Authentication Flow](#authentication-flow)
- [User Roles](#user-roles)
- [Database Models](#database-models)
- [Status Flow](#status-flow)
- [Frontend](#frontend)
- [Screenshots](#screenshots)
- [Author](#author)

---

## Overview

FreightFlow is a logistics management platform that solves the coordination problem between cargo senders and delivery drivers. Shippers create shipment requests with pickup and delivery details. Admins assign available drivers to pending shipments. Drivers then progress shipments through a defined delivery lifecycle and update status in real time — with Socket.io pushing live updates to any connected client watching that shipment.

The project includes a simulated payment layer so shippers can mark a shipment as paid before or after delivery.

---

## Key Features

- **JWT-based authentication** with role-based access control (RBAC)
- **Three user roles** — Shipper, Driver, Admin — each with isolated route access
- **Shipment lifecycle management** — create, assign, track, and deliver
- **Real-time status updates** via Socket.io (per-shipment rooms)
- **Admin dashboard API** — platform-wide analytics, user management, driver assignment
- **Simulated payment flow** — initiate and confirm payments per shipment
- **Input validation** on all routes using `express-validator`
- **Security hardening** — Helmet, CORS, rate limiting on auth routes
- **Structured error handling** with a global error handler and consistent response format
- **React frontend** with protected routes, role-specific dashboards, and live notifications

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express v4 |
| Database | MongoDB via Mongoose v9 |
| Authentication | JWT (`jsonwebtoken` + `bcryptjs`) |
| Real-time | Socket.io v4 |
| Validation | `express-validator` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Logging | `morgan` |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Bundler | Vite |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 |
| HTTP Client | Axios |
| Real-time | socket.io-client v4 |
| Icons | lucide-react |

---

## Project Structure

```
FreightFlow/
├── freightflow-backend/          # Node.js / Express API
│   ├── server.js                 # Entry point — HTTP server + Socket.io boot
│   ├── .env.example              # Environment variable template
│   └── src/
│       ├── app.js                # Express app, middleware, route mounting
│       ├── config/
│       │   └── db.js             # MongoDB connection
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── shipmentController.js
│       │   ├── adminController.js
│       │   ├── driverController.js
│       │   └── paymentController.js
│       ├── middlewares/
│       │   ├── auth.js           # protect, authorizeRoles
│       │   ├── errorHandler.js   # notFound, errorHandler
│       │   └── validateObjectId.js
│       ├── models/
│       │   ├── User.js
│       │   ├── Shipment.js
│       │   └── Payment.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── shipmentRoutes.js
│       │   ├── adminRoutes.js
│       │   ├── driverRoutes.js
│       │   └── paymentRoutes.js
│       ├── scripts/
│       │   └── seedAdmin.js      # One-time admin account seeder
│       ├── services/
│       │   ├── socketService.js  # Socket.io initialization and room management
│       │   ├── paymentService.js # Mock transaction ID generator
│       │   └── notificationService.js  # Console-based notification stubs
│       └── utils/
│           ├── responseFormatter.js  # successResponse(), errorResponse()
│           ├── getIO.js              # Socket.io singleton
│           └── httpStatus.js         # HTTP status constants
│
└── client/                       # React frontend
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── api/                  # Axios API modules per domain
        ├── components/           # Shared UI components + layout pieces
        ├── context/              # AuthContext, NotificationContext
        ├── hooks/                # useAuth, useNotification
        ├── layouts/              # AuthLayout, DashboardLayout
        ├── pages/                # Page components per role
        │   ├── auth/
        │   ├── shipper/
        │   ├── driver/
        │   └── admin/
        ├── routes/               # AppRouter, ProtectedRoute
        ├── socket/               # socketClient singleton, useSocket hooks
        ├── styles/               # Global CSS + Tailwind tokens
        └── utils/                # formatters (date, currency, status)
```

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Clone the repository

```bash
git clone https://github.com/Ayush-o1/FreightFlow.git
cd FreightFlow
```

---

## Environment Variables

### Backend

Copy the example file and fill in your values:

```bash
cd freightflow-backend
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the server listens on | `5000` |
| `NODE_ENV` | Runtime environment | `development` |
| `MONGODB_URI` | Full MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/FreightFlow` |
| `JWT_SECRET` | Secret key for signing JWTs | `your_random_secret_here` |
| `JWT_EXPIRES_IN` | JWT expiry duration | `7d` |
| `CLIENT_URL` | Frontend origin for CORS and Socket.io | `http://localhost:5173` |
| `ADMIN_EMAIL` | Email for the seeded admin account | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the seeded admin account | `change_this_password` |
| `ADMIN_NAME` | Display name for the seeded admin | `Super Admin` |

> **Never commit your `.env` file.** It is listed in `.gitignore`.

To generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend

```bash
cd client
cp .env.example .env   # create client/.env if it doesn't exist
```

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend base URL | `http://localhost:5000` |

---

## Running Locally

### 1 — Start the backend

```bash
cd freightflow-backend
npm install

# Seed the admin account (run once)
node src/scripts/seedAdmin.js

# Start development server
npm run dev
# API available at http://localhost:5000
```

### 2 — Start the frontend

```bash
cd client
npm install
npm run dev
# App available at http://localhost:5173
```

---

## API Reference

### Health Check

```
GET /api/health
```

Returns server status, environment, and uptime. No authentication required.

---

### Auth — `/api/auth`

> Rate limited: **10 requests per 15 minutes per IP**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | No | Register a new shipper or driver |
| `POST` | `/api/auth/login` | No | Login and receive a JWT |
| `GET` | `/api/auth/me` | Yes | Get the current user's profile |

**Register body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "shipper"
}
```
`role` accepts `"shipper"` or `"driver"`. Defaults to `"shipper"` if omitted. Admin accounts can only be created via the seed script.

**Login response:**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "_id": "...", "name": "Jane Doe", "email": "...", "role": "shipper" }
  }
}
```

---

### Shipments — `/api/shipments`

All routes require authentication (`Bearer <token>`).

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/shipments` | Shipper | Create a new shipment |
| `GET` | `/api/shipments/my` | Shipper | Get all own shipments |
| `GET` | `/api/shipments/:id` | Shipper / Driver / Admin | Get a single shipment with full status history |

**Create shipment body:**
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
  "description": "Fragile — handle with care",
  "estimatedDelivery": "2025-06-15T00:00:00.000Z"
}
```

---

### Driver — `/api/driver`

All routes require authentication with `role = driver`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/driver/shipments` | List all shipments assigned to this driver |
| `GET` | `/api/driver/shipments/:id` | Get full detail of a specific assigned shipment |
| `PATCH` | `/api/driver/shipments/:id/status` | Advance delivery status |

**Status update body:**
```json
{
  "status": "picked_up",
  "note": "Picked up from warehouse at 10:30 AM"
}
```

Status must follow the forward-only progression:
`assigned` → `picked_up` → `in_transit` → `delivered`

---

### Admin — `/api/admin`

All routes require authentication with `role = admin`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/analytics` | Platform-wide totals, revenue, recent activity |
| `GET` | `/api/admin/shipments` | All shipments — supports `?status=`, `?search=`, `?page=`, `?limit=` |
| `GET` | `/api/admin/shipments/:id` | Full detail of any single shipment |
| `PATCH` | `/api/admin/shipments/:id/assign` | Assign a driver to a pending shipment |
| `GET` | `/api/admin/users` | All users — supports `?role=shipper|driver|admin` |
| `GET` | `/api/admin/drivers` | Active drivers only (lightweight, for dropdown use) |

**Assign driver body:**
```json
{
  "driverId": "<driver_user_id>"
}
```

Analytics response includes: `totalShipments`, `shipmentsByStatus`, `totalShippers`, `totalDrivers`, `totalRevenue`, `recentShipments`.

---

### Payments — `/api/payments`

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/payments/initiate/:shipmentId` | Shipper | Create a pending payment record |
| `POST` | `/api/payments/confirm/:paymentId` | Shipper | Simulate payment success or failure |
| `GET` | `/api/payments/:shipmentId` | Shipper / Admin | Get payment record for a shipment |

**Initiate body:**
```json
{
  "amount": 4500,
  "paymentMethod": "card"
}
```
`paymentMethod` accepts: `"card"`, `"upi"`, `"netbanking"`.

**Confirm body:**
```json
{
  "simulate": "success"
}
```
Pass `"success"` to mark the payment as paid, or `"failure"` to mark it as failed. This is a simulated gateway — no real money is involved.

---

## Real-Time Events (Socket.io)

Connect to the backend WebSocket server. Clients must join a shipment-specific room to receive events for that shipment.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinShipmentRoom` | `{ shipmentId }` | Subscribe to live updates for a shipment |
| `leaveShipmentRoom` | `{ shipmentId }` | Unsubscribe from a shipment room |

### Server → Client

| Event | Payload | Triggered When |
|-------|---------|----|
| `statusUpdated` | `{ shipmentId, newStatus, updatedBy, role, note, timestamp }` | Driver advances shipment status |
| `shipmentDelivered` | `{ shipmentId, message, timestamp }` | Status reaches `delivered` |
| `driverAssigned` | `{ shipmentId, driverId, driverName, status, message, timestamp }` | Admin assigns a driver |

Room naming convention: `shipment_<shipmentId>`

---

## Authentication Flow

1. User calls `POST /api/auth/login` with email and password.
2. Server verifies credentials and returns a signed JWT (expires per `JWT_EXPIRES_IN`).
3. Client stores the token and attaches it to every subsequent request as:
   ```
   Authorization: Bearer <token>
   ```
4. The `protect` middleware on each protected route verifies the token, checks the user still exists and is active, then attaches the user to `req.user`.
5. The `authorizeRoles(...roles)` middleware checks `req.user.role` against the allowed roles for that route.
6. Admin accounts cannot be registered via the public API — they must be created using the seed script (`node src/scripts/seedAdmin.js`).

---

## User Roles

| Action | Shipper | Driver | Admin |
|--------|:-------:|:------:|:-----:|
| Register / Login | ✅ | ✅ | Seed only |
| Create shipment | ✅ | ❌ | ❌ |
| View own shipments | ✅ | ❌ | ❌ |
| View any shipment | ❌ | ❌ | ✅ |
| Assign driver to shipment | ❌ | ❌ | ✅ |
| Update delivery status | ❌ | ✅ | ❌ |
| Initiate / confirm payment | ✅ | ❌ | ❌ |
| View platform analytics | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

---

## Database Models

### User

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Required, max 100 chars |
| `email` | String | Unique, lowercase |
| `password` | String | Bcrypt hashed, `select: false` |
| `role` | String | `shipper` / `driver` / `admin` |
| `isActive` | Boolean | Defaults to `true` |
| `createdAt` | Date | Auto (Mongoose timestamps) |

### Shipment

| Field | Type | Notes |
|-------|------|-------|
| `shipper` | ObjectId → User | Required |
| `driver` | ObjectId → User | Null until assigned |
| `pickupLocation` | Object | address, city, state, pincode |
| `deliveryLocation` | Object | address, city, state, pincode |
| `goodsType` | String | e.g. Electronics, Furniture |
| `weight` | Number | In kg, minimum 0.1 |
| `description` | String | Optional |
| `status` | String | Enum — see status flow below |
| `paymentStatus` | String | `unpaid` / `paid` / `failed` |
| `estimatedDelivery` | Date | Optional |
| `statusHistory` | Array | Timestamped log of all status changes |

### Payment

| Field | Type | Notes |
|-------|------|-------|
| `shipment` | ObjectId → Shipment | Unique — one payment per shipment |
| `shipper` | ObjectId → User | |
| `amount` | Number | Minimum 0.01 |
| `status` | String | `pending` / `paid` / `failed` |
| `paymentMethod` | String | `card` / `upi` / `netbanking` |
| `transactionId` | String | Populated on successful payment |
| `paidAt` | Date | Populated when status → `paid` |

---

## Status Flow

```
pending → assigned → picked_up → in_transit → delivered
```

- **`pending`** — Shipment created by a shipper, awaiting driver assignment.
- **`assigned`** — Admin has assigned a driver. Driver is notified in real time.
- **`picked_up`** — Driver has collected the cargo from the pickup location.
- **`in_transit`** — Shipment is on its way to the delivery destination.
- **`delivered`** — Shipment has been successfully delivered.
- **`cancelled`** — Shipment was cancelled (stored in status history; no automatic transition).

Status can only move forward. A driver cannot skip steps or revert to a previous status.

---

## Frontend

The React frontend (`/client`) is a full single-page application with:

- **Login and Register pages** with form validation and demo credentials
- **Role-based routing** — users are redirected to their role's dashboard after login
- **Protected routes** — unauthenticated or wrong-role access is blocked
- **Shipper dashboard** — create shipments, view shipment list with status, make payments
- **Driver dashboard** — view assigned shipments, update delivery status inline
- **Admin dashboard** — platform analytics, all-shipments table with filters, user list, driver assignment workflow
- **Real-time notifications** — Socket.io updates push live status changes to the UI
- **Toast notifications** — success/error/info toasts for all user actions
- **Notification bell** — persistent in-session notification history in the topbar

### Frontend Scripts

```bash
cd client
npm run dev      # Start development server (Vite)
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # ESLint check
```

---

## Screenshots

> Screenshots will be added after deployment.

---

## Author

**Ayush Kumar**

- GitHub: [https://github.com/Ayush-o1](https://github.com/Ayush-o1)

---

*Built as a full-stack portfolio project demonstrating REST API design, real-time communication, role-based access control, and React application architecture.*
