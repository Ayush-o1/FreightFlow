/**
 * useNotification.js
 * Convenience re-export of the useNotification hook from NotificationContext.
 * Import this hook in page/component files for cleaner import paths.
 *
 * Usage:
 *   import { useNotification } from '../hooks/useNotification';
 *   const { showToast, addNotification } = useNotification();
 */

export { useNotification } from '../context/NotificationContext';
