/**
 * useNotification.js
 * Convenience hook for reading NotificationContext.
 * Import this hook in page/component files for cleaner import paths.
 *
 * Usage:
 *   import { useNotification } from '../hooks/useNotification';
 *   const { showToast, addNotification } = useNotification();
 */

import { useContext } from 'react';
import NotificationContext from '../context/notificationContextValue';

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used inside <NotificationProvider>');
  }
  return ctx;
}
