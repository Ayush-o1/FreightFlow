# FreightFlow — Frontend

The React single-page application for FreightFlow.

For the full project overview and API documentation, see the [root README](../README.md).

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set VITE_API_BASE_URL to your backend URL

# Start development server
npm run dev
# App runs at http://localhost:5173
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Bundler | Vite 5 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 |
| HTTP | Axios |
| Real-time | socket.io-client v4 |
| Icons | lucide-react |

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000` |

---

## Pages by Role

### Shipper
- Login / Register
- Dashboard — shipment summary stats
- Shipment list — all own shipments with status
- Shipment detail — full status timeline, driver info, payment
- Create shipment

### Driver
- Dashboard — active delivery cards, recent completions
- Assignments — full list with inline status update

### Admin
- Dashboard — platform analytics, recent users and shipments
- All shipments — paginated table with filters and driver assignment
- Users — full user list with role filter and search
- Assign driver — select a driver for a pending shipment

---

## Folder Structure

```
client/src/
├── api/           # Axios modules: adminApi, shipmentApi, driverApi, paymentApi
├── components/
│   ├── shared/    # NotificationBell, ToastContainer, PageHeader
│   └── ui/        # Badge, Button, Card, Input, Select, Spinner, EmptyState
├── context/       # AuthContext, NotificationContext
├── hooks/         # useAuth, useNotification
├── layouts/       # AuthLayout, DashboardLayout
├── pages/         # auth/, shipper/, driver/, admin/
├── routes/        # AppRouter, ProtectedRoute
├── socket/        # socketClient singleton, useSocket hooks
├── styles/        # index.css with Tailwind tokens
└── utils/         # formatters (date, currency, status)
```
