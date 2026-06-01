'use strict';

const rateLimit = require('express-rate-limit');

const buildHandler = (message) => (req, res) => {
  const body = {
    success: false,
    statusCode: 429,
    message,
  };

  if (res.locals?.requestId) body.requestId = res.locals.requestId;

  res.status(429).json(body);
};

const skipInTests = () => process.env.NODE_ENV === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many requests. Please try again after 15 minutes.'),
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many token refresh attempts. Please try again later.'),
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildHandler('Too many requests. Please slow down and try again later.'),
});

module.exports = {
  authLimiter,
  refreshLimiter,
  generalLimiter,
};
