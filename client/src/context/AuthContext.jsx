/**
 * AuthContext.jsx
 * Full authentication state implementation for FreightFlow.
 *
 * Provides:
 *   user     — { _id, name, email, role } | null
 *   token    — JWT string | null
 *   isLoading — true while localStorage hydration runs on mount
 *   login(userData, token) — persists session, sets state
 *   logout(navigate)       — clears session, redirects to /login
 *
 * Note on logout: useNavigate cannot be called inside a context provider
 * directly (it requires a Router ancestor). We accept `navigate` as an
 * argument so callers (components inside Router) pass it in.
 */

import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

// ── Storage keys ──────────────────────────────────────────────────────────────
const TOKEN_KEY = 'ff_token';
const USER_KEY  = 'ff_user';

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Mount effect: hydrate auth state from localStorage.
   * Runs once. Catches corrupt JSON and clears storage if needed.
   */
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser  = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Corrupt data — force a clean state
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * login — called after a successful API authentication response.
   * @param {Object} userData — { _id | id, name, email, role }
   * @param {string} jwt      — JWT string from backend
   */
  const login = (userData, jwt) => {
    // Normalize: backend login returns `id`, register returns `_id`.
    // Store consistently as `_id` so the rest of the app always uses `_id`.
    const normalized = {
      _id:   userData._id ?? userData.id,
      name:  userData.name,
      email: userData.email,
      role:  userData.role,
    };

    setToken(jwt);
    setUser(normalized);
    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  };

  /**
   * logout — clears all auth state.
   * @param {Function} navigate — React Router navigate fn from the calling component.
   *   Pass navigate from useNavigate() in the component that triggers logout.
   */
  const logout = (navigate) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // navigate may not be provided in edge cases — fall back to hard redirect
    if (typeof navigate === 'function') {
      navigate('/login', { replace: true });
    } else {
      window.location.href = '/login';
    }
  };

  const value = { user, token, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}

export default AuthContext;
