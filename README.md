# FreightFlow — Backend API

FreightFlow is a **logistics SaaS backend** built with Node.js, Express, and MongoDB. It provides a complete role-based platform for managing freight shipments across three user roles — **Shipper**, **Driver**, and **Admin** — with real-time tracking via Socket.io and a simulated payment layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express v4 |
| Database | MongoDB (Mongoose v8) |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| Real-time | Socket.io v4 |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| Logging | morgan |

---

## Running Locally

```bash
# 1. Clone the repository
git clone <repo-url>
cd freightflow-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME

# 4. Seed the admin account
node src/scripts/seedAdmin.js

# 5. Start the development server
npm run dev
# Server runs on http://localhost:5000
```

---

## API Routes

### Auth  (`/api/auth`)

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/api/auth/register` | No | — |
| POST | `/api/auth/login` | No | — |
| GET | `/api/auth/me` | Yes | Any |

> Auth routes are rate-limited: **10 requests per 15 minutes per IP**.

---

### Shipper  (`/api/shipments`)

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/api/shipments` | Yes | Shipper |
| GET | `/api/shipments/my` | Yes | Shipper |
| GET | `/api/shipments/:id` | Yes | Shipper / Admin |

---

### Admin  (`/api/admin`)

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/admin/analytics` | Yes | Admin |
| GET | `/api/admin/shipments` | Yes | Admin |
| GET | `/api/admin/shipments/:id` | Yes | Admin |
| PATCH | `/api/admin/shipments/:id/assign` | Yes | Admin |
| GET | `/api/admin/users` | Yes | Admin |
| GET | `/api/admin/drivers` | Yes | Admin |

---

### Driver  (`/api/driver`)

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/driver/shipments` | Yes | Driver |
| GET | `/api/driver/shipments/:id` | Yes | Driver |
| PATCH | `/api/driver/shipments/:id/status` | Yes | Driver |

**Status progression (forward-only):**
`assigned` → `picked_up` → `in_transit` → `delivered`

---

### Payment  (`/api/payments`)

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/api/payments/initiate/:shipmentId` | Yes | Shipper |
| POST | `/api/payments/confirm/:paymentId` | Yes | Shipper |
| GET | `/api/payments/:shipmentId` | Yes | Shipper / Admin |

`confirm` body: `{ "simulate": "success" | "failure" }`

---

## Socket.io Events

Connect to the server at `ws://localhost:5000`.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinShipmentRoom` | `{ shipmentId }` | Join a private room for a shipment |
| `leaveShipmentRoom` | `{ shipmentId }` | Leave a shipment room |

### Server → Client

| Event | Payload | Trigger |
|-------|---------|---------|
| `driverAssigned` | `{ shipmentId, driverId, driverName, status, message, timestamp }` | Admin assigns driver |
| `statusUpdated` | `{ shipmentId, newStatus, updatedBy, role, note, timestamp }` | Driver updates status |
| `shipmentDelivered` | `{ shipmentId, message, timestamp }` | Status reaches `delivered` |

---

## Folder Structure

```
freightflow-backend/
├── .env                        # Local environment variables (not committed)
├── .env.example                # Environment template
├── server.js                   # Entry point — HTTP server + Socket.io boot
└── src/
    ├── app.js                  # Express app, middleware, route mounting
    ├── config/
    │   └── db.js               # MongoDB connection
    ├── controllers/
    │   ├── authController.js
    │   ├── shipmentController.js
    │   ├── adminController.js
    │   ├── driverController.js
    │   └── paymentController.js
    ├── middlewares/
    │   ├── auth.js             # protect, authorizeRoles
    │   ├── errorHandler.js     # notFound, errorHandler
    │   └── validateObjectId.js # MongoDB ObjectId param guard
    ├── models/
    │   ├── User.js
    │   ├── Shipment.js
    │   └── Payment.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── shipmentRoutes.js
    │   ├── adminRoutes.js
    │   ├── driverRoutes.js
    │   └── paymentRoutes.js
    ├── scripts/
    │   └── seedAdmin.js        # One-time admin account seeder
    ├── services/
    │   ├── paymentService.js   # generateMockTransactionId()
    │   ├── socketService.js    # initSocket(), room management
    │   └── notificationService.js  # Mock email notifications (console.log)
    └── utils/
        ├── responseFormatter.js  # successResponse(), errorResponse()
        ├── getIO.js              # Socket.io singleton (setIO, getIO)
        └── httpStatus.js         # HTTP status code constants
```

---

## Roles & Permissions Summary

| Action | Shipper | Driver | Admin |
|--------|---------|--------|-------|
| Register / Login | ✅ | ✅ | Seed only |
| Create shipment | ✅ | ❌ | ❌ |
| View own shipments | ✅ | ❌ | ❌ |
| View all shipments | ❌ | ❌ | ✅ |
| Assign driver | ❌ | ❌ | ✅ |
| Update delivery status | ❌ | ✅ | ❌ |
| Initiate / confirm payment | ✅ | ❌ | ❌ |
| View analytics | ❌ | ❌ | ✅ |

---

## Status Flow

```
pending → assigned → picked_up → in_transit → delivered
                                             ↘ cancelled (admin)
```

---

*Backend built across 8 phases — ready for frontend integration.*
