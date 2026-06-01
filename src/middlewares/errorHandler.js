'use strict';

const { errorResponse } = require('../utils/responseFormatter');
const logger = require('../config/logger');

/**
 * 404 Not Found Middleware
 *
 * Catches any request that falls through all defined routes.
 * Creates an error and passes it to the global error handler.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Global Error Handling Middleware
 *
 * Must have exactly 4 arguments for Express to recognize it as an error handler.
 * Normalizes all errors — including Mongoose validation errors, JWT errors,
 * and cast errors — into a consistent JSON error response.
 *
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error(
    {
      err,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      userId: req.user?._id,
    },
    'Request failed'
  );

  // Default to 500 if no status code is set on the error
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose: Bad ObjectId (CastError) ──────────────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = `Invalid ID format: ${err.value}`;
  }

  // ── Mongoose: Validation Error ───────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 422;
    // Flatten all field-level validation messages into a single string
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
  }

  // ── Mongoose: Duplicate Key Error ────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for '${field}'. Please use a different value.`;
  }

  // ── JWT: Token Errors ────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // ── Express: Payload Too Large ───────────────────────────────────────────
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload is too large.';
  }

  return errorResponse(res, statusCode, message);
};

module.exports = { notFound, errorHandler };
