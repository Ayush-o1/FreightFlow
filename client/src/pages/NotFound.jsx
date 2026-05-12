/**
 * NotFound.jsx — 404 page
 * Shown for any route that doesn't match a defined path.
 */

import { useNavigate } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
         style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
        <PackageX size={36} color="var(--color-primary)" />
      </div>
      <h1 className="mb-2 text-4xl font-bold text-[var(--color-text-primary)]">404</h1>
      <p className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">
        Page not found
      </p>
      <p className="mb-8 max-w-sm text-sm text-[var(--color-text-secondary)]">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button variant="primary" onClick={() => navigate(-1)}>
        Go back
      </Button>
    </div>
  );
}
