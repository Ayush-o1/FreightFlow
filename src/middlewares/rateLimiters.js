'use strict';

const rateLimit = require('express-rate-limit');

const buildHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    message,
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many requests. Please try again after 15 minutes.'),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many token refresh attempts. Please try again later.'),
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many requests. Please slow down and try again later.'),
});

module.exports = {
  authLimiter,
  refreshLimiter,
  generalLimiter,
};
