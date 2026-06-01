/**
 * NotificationContext.jsx
 * Global notification state — two concerns:
 *
 *   1. Persistent notification list (bell dropdown history):
 *      notifications: [{ id, type, title, message, timestamp, read }]
 *      Max 20 — oldest pruned automatically.
 *
 *   2. Transient toasts (auto-dismiss):
 *      toasts: [{ id, type, message, duration }]
 *      Auto-removed after `duration` ms. Max 5 visible at once.
 *
 * In-memory only — clears on page refresh by design.
 *
 * Wrap order in main.jsx:
 *   <AuthProvider>
 *     <NotificationProvider>
 *       <App />
 *     </NotificationProvider>
 *   </AuthProvider>
 */

import { useCallback, useRef, useState } from 'react';
import NotificationContext from './notificationContextValue';

// ── Provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [toasts,        setToasts]        = useState([]);

  // Track timeout IDs so we can cancel them if a toast is dismissed early
  const toastTimers = useRef({});

  // ── Bell notification list ────────────────────────────────────────────────

  /**
   * Prepend a new notification to the bell history.
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {string} title
   * @param {string} message
   */
  const addNotification = useCallback((type, title, message) => {
    const entry = {
      id:        Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read:      false,
    };
    setNotifications((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  /** Mark all bell notifications as read. */
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /** Remove all bell notifications. */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // ── Toast system ──────────────────────────────────────────────────────────

  /**
   * Show a transient toast that auto-dismisses after `duration` ms.
   * Keeps at most 5 toasts — oldest is dropped if limit exceeded.
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {string} message
   * @param {number} [duration=4000] — ms before auto-dismiss
   */
  const showToast = useCallback((type, message, duration = 4000) => {
    const id = Date.now() + Math.random(); // ensure uniqueness on rapid calls

    setToasts((prev) => {
      const next = [{ id, type, message, duration }, ...prev];
      // Drop oldest if over limit
      return next.slice(0, 5);
    });

    // Auto-remove after duration
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete toastTimers.current[id];
    }, duration);

    toastTimers.current[id] = timer;
  }, []);

  /**
   * Dismiss a specific toast immediately (cancels its auto-remove timer).
   * @param {number} id
   */
  const dismissToast = useCallback((id) => {
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    // Bell
    notifications,
    addNotification,
    markAllRead,
    clearNotifications,
    unreadCount: notifications.filter((n) => !n.read).length,

    // Toasts
    toasts,
    showToast,
    dismissToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
