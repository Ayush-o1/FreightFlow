/**
 * ToastContainer.jsx
 * Fixed bottom-right toast stack — reads toasts from useNotification().
 *
 * Slide-in animation: translate-x-full → translate-x-0 (300ms ease-out)
 * Close: opacity-100 → opacity-0 then removed from DOM (handled by dismissToast)
 *
 * Stack: newest on top (toasts[0] = newest because showToast prepends).
 * Max 5 toasts enforced in NotificationContext.
 * Auto-dismiss timer lives in NotificationContext.showToast.
 *
 * No animation libraries — Tailwind transition classes only.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';

// ── Per-type config ───────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: {
    icon:        CheckCircle2,
    borderClass: 'border-l-green-500',
    iconClass:   'text-green-500',
  },
  error: {
    icon:        XCircle,
    borderClass: 'border-l-red-500',
    iconClass:   'text-red-500',
  },
  info: {
    icon:        Info,
    borderClass: 'border-l-blue-500',
    iconClass:   'text-blue-500',
  },
  warning: {
    icon:        AlertTriangle,
    borderClass: 'border-l-amber-500',
    iconClass:   'text-amber-500',
  },
};

// ── Single toast item with enter animation ────────────────────────────────────
function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  // Trigger enter animation on mount (requires a frame delay for transition)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const config    = TOAST_CONFIG[toast.type] ?? TOAST_CONFIG.info;
  const Icon      = config.icon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3',
        'rounded-lg border border-[var(--color-border)] border-l-4 bg-white px-4 py-3 shadow-lg',
        config.borderClass,
        // Slide-in from right
        'transition-transform duration-300 ease-out',
        visible ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      {/* Type icon */}
      <Icon size={18} className={`mt-0.5 shrink-0 ${config.iconClass}`} />

      {/* Message */}
      <p className="flex-1 text-sm text-[var(--color-text-primary)]">
        {toast.message}
      </p>

      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="ml-auto shrink-0 rounded p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-gray-100 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────
export default function ToastContainer() {
  const { toasts, dismissToast } = useNotification();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Toast notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      // flex-col-reverse: newest toast (toasts[0]) renders at bottom,
      // stacking upward so the most recent is visually closest to the corner.
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
