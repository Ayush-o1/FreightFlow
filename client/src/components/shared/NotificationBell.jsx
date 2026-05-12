/**
 * NotificationBell.jsx
 * Topbar bell icon with unread count badge and dropdown notification list.
 *
 * Reads from useNotification() — no props needed.
 * Outside-click detection closes the dropdown.
 */

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { formatDate }       from '../../utils/formatters';

// ── Colour map for left-border accent ────────────────────────────────────────
const BORDER_COLOR = {
  success: 'border-l-green-500',
  error:   'border-l-red-500',
  info:    'border-l-blue-500',
  warning: 'border-l-amber-500',
};

// ── Single notification item ──────────────────────────────────────────────────
function NotificationItem({ item }) {
  return (
    <li
      className={[
        'border-l-4 px-4 py-3',
        BORDER_COLOR[item.type] ?? 'border-l-gray-300',
        item.read ? 'bg-[var(--color-surface)]' : 'bg-blue-50',
      ].join(' ')}
    >
      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
        {item.title}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">
        {item.message}
      </p>
      <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
        {formatDate(item.timestamp)}
      </p>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
  } = useNotification();

  const [open, setOpen] = useState(false);
  const containerRef    = useRef(null);

  // Outside-click closes dropdown
  useEffect(() => {
    if (!open) return;

    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell button ── */}
      <button
        id="notification-bell-btn"
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-gray-100 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className={[
            'absolute right-0 top-full mt-2 z-50',
            'w-80 max-w-[calc(100vw-2rem)]',
            'rounded-xl border border-[var(--color-border)]',
            'bg-[var(--color-surface)] shadow-lg',
            'overflow-hidden',
          ].join(' ')}
          role="dialog"
          aria-label="Notification panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
              No notifications yet
            </p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-[var(--color-border)] overflow-y-auto">
              {notifications.map((item) => (
                <NotificationItem key={item.id} item={item} />
              ))}
            </ul>
          )}

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-[var(--color-border)] px-4 py-2.5 text-center">
              <button
                onClick={clearNotifications}
                className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
