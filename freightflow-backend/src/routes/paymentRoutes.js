'use strict';

const express = require('express');
const {
  initiatePayment,
  confirmPayment,
  getPaymentByShipment,
} = require('../controllers/paymentController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const validateObjectId            = require('../middlewares/validateObjectId');

const router = express.Router();

// ─── All payment routes require authentication ────────────────────────────────
router.use(protect);

// @route   POST /api/payments/initiate/:shipmentId
// @desc    Create a pending payment for the given shipment
// @access  Shipper only
router.post(
  '/initiate/:shipmentId',
  authorizeRoles('shipper'),
  validateObjectId('shipmentId'),
  initiatePayment
);

// @route   POST /api/payments/confirm/:paymentId
// @desc    Simulate payment success or failure
// @access  Shipper only
router.post(
  '/confirm/:paymentId',
  authorizeRoles('shipper'),
  validateObjectId('paymentId'),
  confirmPayment
);

// @route   GET /api/payments/:shipmentId
// @desc    Retrieve payment record for a shipment (shipper: own; admin: any)
// @access  Shipper | Admin
router.get(
  '/:shipmentId',
  authorizeRoles('shipper', 'admin'),
  validateObjectId('shipmentId'),
  getPaymentByShipment
);

module.exports = router;
