# FreightFlow — Client

> Modern B2B freight and logistics management platform — React frontend.

## Description

FreightFlow is a full-stack logistics SaaS platform connecting **shippers**, **drivers**, and **administrators** in real time. This directory contains the React frontend client built with Vite and Tailwind CSS v4.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 8 |
| Routing | React Router |
| Styling | Tailwind CSS v4 + custom CSS design tokens |
| HTTP | Axios (single `axiosInstance`) |
| Real-time | Socket.IO client |
| Icons | Lucide React |
| Utilities | clsx |

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- FreightFlow backend running (see `../freightflow-backend`)

---

## Setup & Development

```bash
# 1. Clone the repository
git clone https://github.com/your-username/FreightFlow.git
cd FreightFlow/client

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL to your backend URL

# 4. Start the dev server
npm run dev
# App runs at http://localhost:5173
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the FreightFlow backend API | `http://localhost:5001` |

Create a `.env` file at `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5001
```

> ⚠️ Never commit `.env` to version control. It is listed in `.gitignore`.

---

## Running Backend + Frontend Together

```bash
# Terminal 1 — Backend (from repo root or freightflow-backend/)
cd freightflow-backend
npm install
npm run dev        # Runs on http://localhost:5001

# Terminal 2 — Frontend
cd client
npm run dev        # Runs on http://localhost:5173
```

---

## Build for Production

```bash
npm run build      # Output in client/dist/
npm run preview    # Preview production build locally
```

> **Note:** In production, configure your web server (Nginx, Caddy, etc.) to serve `dist/index.html` for all routes — React Router requires this for client-side routing to work correctly.

---

## Folder Structure

```
client/
├── public/
│   └── favicon.svg          # SVG favicon
├── src/
│   ├── api/                 # Axios API helpers (shipmentApi, driverApi, adminApi, paymentApi)
│   ├── components/
│   │   ├── shared/          # NotificationBell, ToastContainer, PageHeader
│   │   └── ui/              # Badge, Button, Card, Input, Select, Spinner, EmptyState
│   ├── context/             # AuthContext, NotificationContext
│   ├── hooks/               # useAuth, useNotification
│   ├── layouts/             # DashboardLayout (responsive), AuthLayout
│   ├── pages/
│   │   ├── admin/           # AdminDashboard, AdminShipments, AdminUsers, AssignDriver
│   │   ├── auth/            # LoginPage, RegisterPage
│   │   ├── driver/          # DriverDashboard, DriverShipments
│   │   ├── shipper/         # ShipperDashboard, ShipmentList, ShipmentDetail, CreateShipment
│   │   ├── NotFound.jsx
│   │   └── NotAuthorized.jsx
│   ├── routes/              # AppRouter, ProtectedRoute
│   ├── socket/              # useSocket (Socket.IO hooks)
│   ├── styles/              # index.css (design tokens + Tailwind)
│   └── utils/               # formatters.js (formatDate, formatStatus, etc.)
├── .env                     # Local environment (gitignored)
├── .env.example             # Environment variable template
├── index.html               # HTML entry point
└── vite.config.js           # Vite configuration
```

---

## Available Routes by Role

### Public
| Route | Description |
|---|---|
| `/login` | Login page |
| `/register` | Registration page |
| `/unauthorized` | Access denied page |

### Shipper (role: `shipper`)
| Route | Description |
|---|---|
| `/shipper/dashboard` | Overview stats + recent shipments |
| `/shipper/shipments` | All shipments with filter & search |
| `/shipper/shipments/create` | Create a new shipment |
| `/shipper/shipments/:id` | Shipment detail + payment flow |

### Driver (role: `driver`)
| Route | Description |
|---|---|
| `/driver/dashboard` | Active deliveries + stats |
| `/driver/shipments` | All assignments + inline status update |
| `/driver/shipments/:id` | Assigned shipment detail + status timeline |

### Admin (role: `admin`)
| Route | Description |
|---|---|
| `/admin/dashboard` | Platform-wide analytics |
| `/admin/shipments` | All shipments with search & filter |
| `/admin/users` | All registered users |
| `/admin/assign-driver` | Assign a driver to a pending shipment |

---

## Key Features

- **Cookie Authentication** — httpOnly auth cookies, CSRF header, and automatic refresh retry
- **Role-based routing** — `ProtectedRoute` enforces access by role
- **Real-time updates** — authorized Socket.IO shipment rooms update status live without page refresh
- **Notification system** — In-app bell + toast stack for socket events
- **Responsive design** — Mobile overlay sidebar, tablet icon-only sidebar, full desktop sidebar
- **Skeleton loading** — All data-fetching pages show animated pulse skeletons while loading
- **Empty & error states** — Every list/table has a proper empty state and retry card on API failure
