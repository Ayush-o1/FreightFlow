'use strict';

const ACCESS_TOKEN_MAX_AGE_MS = Number(process.env.ACCESS_TOKEN_COOKIE_MAX_AGE_MS)
  || 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const COOKIE_NAMES = {
  access: 'ff_access_token',
  refresh: 'ff_refresh_token',
  csrf: 'ff_csrf_token',
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const normalizeSameSite = (value) => {
  const candidate = String(value || 'strict').toLowerCase();
  return ['strict', 'lax', 'none'].includes(candidate) ? candidate : 'strict';
};

const buildAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || '';

  if (!raw || raw === '*') {
    return process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://localhost:5174'];
  }

  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const getCookieBaseOptions = ({ httpOnly = true, maxAge }) => {
  const secure = parseBoolean(
    process.env.COOKIE_SECURE,
    process.env.NODE_ENV === 'production'
  );

  const options = {
    httpOnly,
    secure,
    sameSite: normalizeSameSite(process.env.COOKIE_SAME_SITE),
    path: '/',
  };

  if (maxAge) options.maxAge = maxAge;
  if (process.env.COOKIE_DOMAIN) options.domain = process.env.COOKIE_DOMAIN;

  return options;
};

const getAccessCookieOptions = () =>
  getCookieBaseOptions({ httpOnly: true, maxAge: ACCESS_TOKEN_MAX_AGE_MS });

const getRefreshCookieOptions = () =>
  getCookieBaseOptions({ httpOnly: true, maxAge: REFRESH_TOKEN_MAX_AGE_MS });

const getCsrfCookieOptions = () =>
  getCookieBaseOptions({ httpOnly: false, maxAge: CSRF_TOKEN_MAX_AGE_MS });

const getClearCookieOptions = (cookieOptions) => {
  const { maxAge, expires, ...clearOptions } = cookieOptions;
  return clearOptions;
};

const configureTrustProxy = (app) => {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return;

  if (raw === 'true') {
    app.set('trust proxy', 1);
    return;
  }

  const hops = Number(raw);
  app.set('trust proxy', Number.isFinite(hops) ? hops : raw);
};

module.exports = {
  COOKIE_NAMES,
  buildAllowedOrigins,
  configureTrustProxy,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  getCsrfCookieOptions,
  getClearCookieOptions,
};
