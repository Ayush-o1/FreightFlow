/**
 * NotFound.jsx — 404 page
 * Role-aware redirect: logged-in users go to their dashboard.
 * Unauthenticated users see a "Go to Login" button.
 */

import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const ROLE_DASHBOARD = {
  shipper: '/shipper/dashboard',
  driver:  '/driver/dashboard',
  admin:   '/admin/dashboard',
};

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleHome = () => {
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

      {/* 404 number */}
      <p
        className="text-8xl font-extrabold leading-none mb-4"
        style={{ color: 'var(--color-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        404
      </p>

      <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
        Page not found
      </h1>
      <p className="mb-8 max-w-sm text-sm text-[var(--color-text-secondary)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Button variant="primary" onClick={handleHome}>
        {user ? 'Go to Dashboard' : 'Go to Login'}
      </Button>
    </div>
  );
}
