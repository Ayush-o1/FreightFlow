/**
 * axiosInstance.js
 * Pre-configured Axios instance for all FreightFlow API calls.
 *
 * Features:
 *  - Base URL from VITE_API_BASE_URL env variable
 *  - 10-second request timeout
 *  - withCredentials: true — browser automatically sends httpOnly auth cookies
 *  - No manual Authorization header injection — cookies handle auth transparently
 *  - Response interceptor: on 401, attempts silent token refresh via POST /api/auth/refresh
 *    - If refresh succeeds: retries the original failed request transparently
 *    - If refresh fails:    redirects to /login
 *  - Concurrent 401 handling: queues in-flight requests during a refresh, retries all on success
 */

import axios from 'axios';

const axiosInstance = axios.create({
  baseURL:         import.meta.env.VITE_API_BASE_URL,
  timeout:         10000,
  withCredentials: true,   // Send httpOnly auth cookies automatically with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── CSRF token bootstrap ─────────────────────────────────────────────────────
// Backend uses cookie auth, so unsafe requests must include X-CSRF-Token.
const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
let csrfToken = null;
let csrfPromise = null;

const IDEMPOTENT_MUTATION_PATTERNS = [
  /\/api\/payments\/confirm\/[^/]+$/,
  /\/api\/shipments\/[^/]+\/cancel$/,
  /\/api\/driver\/shipments\/[^/]+\/status$/,
  /\/api\/admin\/shipments\/[^/]+\/assign$/,
  /\/api\/admin\/shipments\/[^/]+\/cancel$/,
];

const isCsrfEndpoint = (url = '') => url.includes('/api/auth/csrf');

const ensureCsrfToken = async () => {
  if (csrfToken) return csrfToken;

  if (!csrfPromise) {
    csrfPromise = axiosInstance
      .get('/api/auth/csrf')
      .then((res) => {
        csrfToken = res.data?.data?.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
};

const buildIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const needsIdempotencyKey = (url = '') =>
  IDEMPOTENT_MUTATION_PATTERNS.some((pattern) => pattern.test(url));

export const clearCsrfToken = () => {
  csrfToken = null;
};

axiosInstance.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toLowerCase();

  if (UNSAFE_METHODS.has(method) && !isCsrfEndpoint(config.url)) {
    const token = await ensureCsrfToken();
    config.headers = config.headers || {};
    config.headers['X-CSRF-Token'] = token;

    if (needsIdempotencyKey(config.url) && !config.headers['Idempotency-Key']) {
      config.headers['Idempotency-Key'] = buildIdempotencyKey();
    }
  }

  return config;
});

// ── Refresh queue state ────────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls when several requests return 401 at once.
let isRefreshing  = false;
let failedQueue   = [];

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
  failedQueue = [];
};

// ── Response interceptor ───────────────────────────────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const status          = error.response?.status;
    const message         = error.response?.data?.message || '';

    if (
      status === 403 &&
      message.includes('CSRF') &&
      !originalRequest._csrfRetry
    ) {
      clearCsrfToken();
      originalRequest._csrfRetry = true;
      await ensureCsrfToken();
      return axiosInstance(originalRequest);
    }

    // Pass through non-401 errors immediately
    if (status !== 401) {
      return Promise.reject(error);
    }

    // ── Safety guards: do NOT attempt refresh in these cases ─────────────────

    // Guard 1: The refresh endpoint itself returned 401 — do not retry again
    if (originalRequest.url?.includes('/api/auth/refresh')) {
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Guard 2: GET /api/auth/me during initial hydration returned 401 —
    // this means the user is not logged in. Let AuthContext's .catch() handle it.
    // Do NOT redirect here — this is the expected "no session" path on first visit.
    if (originalRequest.url?.includes('/api/auth/me') && !originalRequest._retry) {
      return Promise.reject(error);
    }

    // Guard 3: Already retried once — stop to prevent loops
    if (originalRequest._retry) {
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // ── Queue management: if refresh already in progress, wait for it ─────────
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => axiosInstance(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    // ── Attempt token refresh ─────────────────────────────────────────────────
    originalRequest._retry = true;
    isRefreshing           = true;

    try {
      // POST /api/auth/refresh reads ff_refresh_token cookie and sets new cookies.
      // withCredentials is inherited from the instance — cookies are sent automatically.
      await axiosInstance.post('/api/auth/refresh');

      processQueue(null);                    // Resolve all queued requests
      return axiosInstance(originalRequest); // Retry the original request
    } catch (refreshError) {
      processQueue(refreshError);            // Reject all queued requests
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
