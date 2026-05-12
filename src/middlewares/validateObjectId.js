'use strict';

const mongoose = require('mongoose');
const { errorResponse } = require('../utils/responseFormatter');
const { BAD_REQUEST }   = require('../utils/httpStatus');

/**
 * Middleware factory for validating MongoDB ObjectId route params.
 *
 * Usage:
 *   router.get('/:id',        validateObjectId(),              handler);
 *   router.get('/:shipmentId', validateObjectId('shipmentId'), handler);
 *   router.get('/:paymentId',  validateObjectId('paymentId'),  handler);
 *
 * @param {string} [paramName='id'] - The route param key to validate
 * @returns {import('express').RequestHandler}
 */
const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName];

  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return errorResponse(res, BAD_REQUEST, 'Invalid ID format.');
  }

  next();
};

module.exports = validateObjectId;
