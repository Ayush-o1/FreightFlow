# FreightFlow — Backend API

The Node.js/Express REST API and Socket.io server for FreightFlow.

For the full project overview, see the [root README](../README.md).

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and admin credentials

# Seed the admin account (run once)
node src/scripts/seedAdmin.js

# Start development server (with hot reload)
npm run dev

# Start production server
npm start
```

Server runs on `http://localhost:5000` by default.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `npm start` | Start with plain Node.js |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express v4 |
| Database | MongoDB via Mongoose v9 |
| Authentication | JWT + bcryptjs |
| Real-time | Socket.io v4 |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| Logging | morgan |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values.

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | Full MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs (generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Token expiry, e.g. `7d` |
| `CLIENT_URL` | Frontend origin for CORS and Socket.io |
| `ADMIN_EMAIL` | Email for the seeded admin account |
| `ADMIN_PASSWORD` | Password for the seeded admin account |
| `ADMIN_NAME` | Display name for the seeded admin |

---

## API Routes

Full request/response documentation: [`docs/API.md`](../docs/API.md)

| Prefix | Description | Auth |
|--------|-------------|------|
| `GET /api/health` | Server health check | No |
| `/api/auth` | Register, login, profile | Rate limited |
| `/api/shipments` | Create and view shipments | Shipper |
| `/api/driver` | View assignments, update status | Driver |
| `/api/admin` | Analytics, user/shipment management, assign drivers | Admin |
| `/api/payments` | Initiate and confirm simulated payments | Shipper |

---

## Socket.io Events

Room naming: `shipment_<shipmentId>`

**Client → Server:** `joinShipmentRoom`, `leaveShipmentRoom`

**Server → Client:** `statusUpdated`, `shipmentDelivered`, `driverAssigned`

---

## Folder Structure

```
freightflow-backend/
├── server.js               # Entry point
├── .env.example            # Environment template
└── src/
    ├── app.js              # Express setup, middleware, routes
    ├── config/db.js        # MongoDB connection
    ├── controllers/        # Route handlers
    ├── middlewares/        # auth, errorHandler, validateObjectId
    ├── models/             # User, Shipment, Payment
    ├── routes/             # Express routers
    ├── scripts/seedAdmin.js
    ├── services/           # socketService, paymentService, notificationService
    └── utils/              # responseFormatter, getIO, httpStatus
```

---

## Status Flow

```
pending → assigned → picked_up → in_transit → delivered
```

Driver status updates are forward-only and enforced server-side.
