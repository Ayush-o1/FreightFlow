'use strict';

/**
 * Sends a standardized success response.
 *
 * Response shape:
 * {
 *   "success": true,
 *   "statusCode": <number>,
 *   "message": <string>,
 *   "data": <object | array | null>
 * }
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}                     statusCode - HTTP status code (e.g. 200, 201)
 * @param {string}                     message    - Human-readable success message
 * @param {object|array|null}          [data]     - Optional payload to return
 * @returns {import('express').Response}
 */
const successResponse = (res, statusCode, message, data = null) => {
  const body = {
    success: true,
    statusCode,
    message,
  };

  // Only include the data key if data was provided (avoids noise in responses)
  if (data !== null && data !== undefined) {
    body.data = data;
  }

  return res.status(statusCode).json(body);
};

/**
 * Sends a standardized error response.
 *
 * Response shape:
 * {
 *   "success": false,
 *   "statusCode": <number>,
 *   "message": <string>
 * }
 *
 * @param {import('express').Response} res        - Express response object
 * @param {number}                     statusCode - HTTP status code (e.g. 400, 401, 500)
 * @param {string}                     message    - Human-readable error message
 * @returns {import('express').Response}
 */
const errorResponse = (res, statusCode, message, data = null) => {
  const body = {
    success: false,
    statusCode,
    message,
  };

  if (res.locals?.requestId) {
    body.requestId = res.locals.requestId;
  }

  if (data !== null && data !== undefined) {
    body.data = data;
  }

  return res.status(statusCode).json(body);
};

module.exports = { successResponse, errorResponse };
