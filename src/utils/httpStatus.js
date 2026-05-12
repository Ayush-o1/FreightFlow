'use strict';

/**
 * HTTP status code constants.
 * Use these across all controllers instead of raw numbers
 * to improve readability and eliminate magic numbers.
 */
const OK             = 200;
const CREATED        = 201;
const BAD_REQUEST    = 400;
const UNAUTHORIZED   = 401;
const FORBIDDEN      = 403;
const NOT_FOUND      = 404;
const CONFLICT       = 409;
const UNPROCESSABLE  = 422;
const INTERNAL_ERROR = 500;

module.exports = {
  OK,
  CREATED,
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
  UNPROCESSABLE,
  INTERNAL_ERROR,
};
