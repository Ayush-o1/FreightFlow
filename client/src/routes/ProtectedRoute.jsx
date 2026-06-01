/**
 * ProtectedRoute.jsx
 * Guards routes requiring authentication and optional role checks.
 *
 * Behaviour:
 *   1. While isLoading (localStorage check in progress) → show full-screen spinner.
 *      This prevents a flash-redirect before state is hydrated.
 *   2. If user is null (not authenticated) → redirect to /login.
 *   3. If allowedRoles provided and user.role not in it → redirect to /unauthorized.
 *   4. Otherwise → render <Outlet /> (nested route children).
 *
 * Props:
 *   allowedRoles — optional string[]  e.g. ['shipper'] or ['admin', 'shipper']
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/ui/Spinner';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isLoading } = useAuth();

  // ── 1. Still hydrating session from server (GET /api/auth/me in flight) ───────
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <Spinner size="lg" color="var(--color-primary)" />
      </div>
    );
  }

  // ── 2. Not authenticated ───────────────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ── 3. Wrong role ──────────────────────────────────────────────────────────
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ── 4. Authorised — render nested route ───────────────────────────────────
  return <Outlet />;
}
