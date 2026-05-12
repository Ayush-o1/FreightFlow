/**
 * NotAuthorized.jsx
 * Shown when a logged-in user tries to access a route their role doesn't permit.
 */

import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotAuthorized() {
  const navigate = useNavigate();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <ShieldOff size={36} color="var(--color-danger)" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
        Access Denied
      </h1>
      <p className="mb-8 max-w-sm text-sm text-[var(--color-text-secondary)]">
        You do not have permission to view this page.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign in as different user
        </Button>
      </div>
    </div>
  );
}
