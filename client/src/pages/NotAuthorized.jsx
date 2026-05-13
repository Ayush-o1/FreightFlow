/**
 * NotAuthorized.jsx
 * Shown when a logged-in user tries to access a route their role doesn't permit.
 */

import { useNavigate } from 'react-router-dom';
import { ShieldX, Truck } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const ROLE_DASHBOARD = {
  shipper: '/shipper/dashboard',
  driver:  '/driver/dashboard',
  admin:   '/admin/dashboard',
};

export default function NotAuthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDashboard = () => {
    if (user?.role) {
      navigate(ROLE_DASHBOARD[user.role] ?? '/login');
    } else {
      navigate('/login');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* FreightFlow wordmark */}
      <div className="mb-10 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
          <Truck size={16} color="white" />
        </div>
        <span
          className="text-base font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          FreightFlow
        </span>
      </div>

      {/* Shield icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <ShieldX size={40} color="var(--color-danger)" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
        Access Denied
      </h1>
      <p className="mb-8 max-w-sm text-sm text-[var(--color-text-secondary)]">
        You don&apos;t have permission to view this page.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button variant="primary" onClick={handleDashboard}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
