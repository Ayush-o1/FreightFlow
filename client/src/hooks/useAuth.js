/**
 * useAuth.js
 * Convenience hook for reading AuthContext.
 * Import this hook in page/component files for cleaner import paths.
 *
 * Usage:
 *   import { useAuth } from '../hooks/useAuth';
 *   const { user, logout } = useAuth();
 */

import { useContext } from 'react';
import AuthContext from '../context/authContextValue';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
