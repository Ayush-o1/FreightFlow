/**
 * useAuth.js
 * Convenience re-export of the useAuth hook from AuthContext.
 * Import this hook in page/component files for cleaner import paths.
 *
 * Usage:
 *   import { useAuth } from '../hooks/useAuth';
 *   const { user, logout } = useAuth();
 */

export { useAuth } from '../context/AuthContext';
