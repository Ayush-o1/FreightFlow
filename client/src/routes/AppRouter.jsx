/**
 * AppRouter.jsx
 * Central route definition using React Router v6 nested route pattern.
 *
 * ProtectedRoute uses <Outlet /> so role-grouped routes share one guard.
 * Each protected group has its own allowedRoles array.
 */

import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Auth pages
import LoginPage    from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// Shipper pages
import ShipperDashboard from '../pages/shipper/ShipperDashboard';
import CreateShipment   from '../pages/shipper/CreateShipment';
import ShipmentList     from '../pages/shipper/ShipmentList';
import ShipmentDetail   from '../pages/shipper/ShipmentDetail';

// Driver pages
import DriverDashboard from '../pages/driver/DriverDashboard';
import DriverShipments from '../pages/driver/DriverShipments';

// Admin pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminShipments from '../pages/admin/AdminShipments';
import AdminUsers     from '../pages/admin/AdminUsers';
import AssignDriver   from '../pages/admin/AssignDriver';

// Utility pages
import NotFound      from '../pages/NotFound';
import NotAuthorized from '../pages/NotAuthorized';

const router = createBrowserRouter([
  // ── Root redirect ────────────────────────────────────────────────────────
  { path: '/', element: <Navigate to="/login" replace /> },

  // ── Public auth routes ───────────────────────────────────────────────────
  { path: '/login',    element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // ── Utility routes ───────────────────────────────────────────────────────
  { path: '/unauthorized', element: <NotAuthorized /> },

  // ── Shipper routes (nested under ProtectedRoute) ─────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['shipper']} />,
    children: [
      { path: '/shipper/dashboard',         element: <ShipperDashboard /> },
      { path: '/shipper/shipments',          element: <ShipmentList /> },
      { path: '/shipper/shipments/create',   element: <CreateShipment /> },
      { path: '/shipper/shipments/:id',      element: <ShipmentDetail /> },
    ],
  },

  // ── Driver routes (nested under ProtectedRoute) ──────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['driver']} />,
    children: [
      { path: '/driver/dashboard',  element: <DriverDashboard /> },
      { path: '/driver/shipments',  element: <DriverShipments /> },
    ],
  },

  // ── Admin routes (nested under ProtectedRoute) ───────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      { path: '/admin/dashboard',     element: <AdminDashboard /> },
      { path: '/admin/shipments',     element: <AdminShipments /> },
      { path: '/admin/users',         element: <AdminUsers /> },
      { path: '/admin/assign-driver', element: <AssignDriver /> },
    ],
  },

  // ── 404 catch-all ────────────────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
