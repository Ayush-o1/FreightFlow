/**
 * AuthLayout.jsx
 * Full-page centered layout for Login and Register pages.
 *
 * Structure:
 *   - Full viewport height, light grey background
 *   - Centered white card (max-width 440px) with the FreightFlow logo
 *   - Children rendered inside the card
 *   - No sidebar or topbar
 */

import { Truck } from 'lucide-react';

export default function AuthLayout({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="w-full max-w-[440px] rounded-xl bg-white p-8 card-shadow border border-[var(--color-border)]"
      >
        {/* FreightFlow Wordmark */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)]">
            <Truck size={24} color="white" />
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--color-text-primary)' }}
          >
            FreightFlow
          </span>
          <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">
            Logistics Management
          </span>
        </div>

        {/* Page content (Login form, Register form, etc.) */}
        {children}
      </div>
    </div>
  );
}
