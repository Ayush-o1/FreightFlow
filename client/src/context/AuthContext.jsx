/**
 * AuthContext.jsx
 * Full authentication state implementation for FreightFlow.
 *
 * Provides:
 *   user      — { _id, name, email, role, isActive, createdAt, updatedAt } | null
 *   isLoading — true while session hydration (GET /api/auth/me) is in progress on mount
 *   login(userData) — sets user state after successful login/register API call
 *   logout(navigate) — calls POST /api/auth/logout, clears state, redirects to /login
 *
 * Session storage strategy (Phase 2):
 *   Tokens are stored exclusively in httpOnly cookies (not accessible to JavaScript).
 *   On every app mount/refresh, GET /api/auth/me is called to hydrate user state from
 *   the server session. isLoading stays true until this call resolves.
 *
 * No localStorage is used for auth — this eliminates the XSS token-theft vector.
 */

import { useEffect, useRef, useState } from 'react';
import axiosInstance from '../api/axiosInstance';
import AuthContext from './authContextValue';

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const cancelledRef = useRef(false);

  /**
   * Mount effect: hydrate auth state from the server session.
   * Calls GET /api/auth/me — succeeds if a valid ff_access_token cookie exists.
   * On 401 (no session / expired and refresh failed): sets user to null.
   * isLoading is set to false regardless of outcome.
   */
  useEffect(() => {
    cancelledRef.current = false;

    axiosInstance
      .get('/api/auth/me')
      .then((res) => {
        if (cancelledRef.current) return;
        const userData = res.data.data.user;
        setUser({
          _id:       userData._id,
          name:      userData.name,
          email:     userData.email,
          role:      userData.role,
          isActive:  userData.isActive,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        });
      })
      .catch(() => {
        // 401 = not logged in — expected on first visit or after session expiry.
        // The axiosInstance interceptor will NOT redirect on this specific call
        // (it guards against /api/auth/me without _retry to allow this path).
        if (!cancelledRef.current) setUser(null);
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  /**
   * login — called after a successful API login or register response.
   * The token is in an httpOnly cookie — we only need to set the user state.
   * @param {Object} userData — { _id, name, email, role, isActive, ... }
   */
  const login = (userData) => {
    setUser({
      _id:       userData._id,
      name:      userData.name,
      email:     userData.email,
      role:      userData.role,
      isActive:  userData.isActive,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    });
  };

  /**
   * logout — invalidates the server session and clears client state.
   * Calls POST /api/auth/logout (which clears DB refresh token + cookies).
   * If the access token is already expired, the call may fail — we clear
   * client state regardless and redirect to /login.
   *
   * @param {Function} navigate — React Router navigate fn from the calling component.
   */
  const logout = async (navigate) => {
    try {
      await axiosInstance.post('/api/auth/logout');
    } catch {
      // Swallow — clear client state even if the server call fails
      // (e.g. access token already expired)
    } finally {
      setUser(null);
      if (typeof navigate === 'function') {
        navigate('/login', { replace: true });
      } else {
        window.location.href = '/login';
      }
    }
  };

  const value = { user, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
