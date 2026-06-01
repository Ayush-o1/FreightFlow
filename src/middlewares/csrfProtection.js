'use strict';

const crypto = require('crypto');
const { errorResponse } = require('../utils/responseFormatter');
const { FORBIDDEN } = require('../utils/httpStatus');
const {
  COOKIE_NAMES,
  getCsrfCookieOptions,
} = require('../config/security');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const issueCsrfToken = (res) => {
  const token = generateCsrfToken();
  res.cookie(COOKIE_NAMES.csrf, token, getCsrfCookieOptions());
  return token;
};

const safeEquals = (left, right) => {
  if (!left || !right) return false;

  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path === '/api/auth/csrf') return next();

  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerToken = req.get(CSRF_HEADER);

  if (!safeEquals(cookieToken, headerToken)) {
    return errorResponse(
      res,
      FORBIDDEN,
      'CSRF validation failed. Refresh the page and try again.'
    );
  }

  next();
};

module.exports = {
  CSRF_HEADER,
  csrfProtection,
  issueCsrfToken,
};
