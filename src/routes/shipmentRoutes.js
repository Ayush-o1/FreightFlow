'use strict';

const express = require('express');
const { body } = require('express-validator');
const {
  createShipment,
  getMyShipments,
  getShipmentById,
  cancelShipment,
} = require('../controllers/shipmentController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const validateObjectId            = require('../middlewares/validateObjectId');
const { idempotency }             = require('../middlewares/idempotency');

const router = express.Router();

// ─── All shipment routes require authentication ───────────────────────────────
router.use(protect);

// ─── Validation: Create Shipment ─────────────────────────────────────────────
const createShipmentValidation = [
  // Pickup Location
  body('pickupLocation.address').trim().notEmpty().withMessage('Pickup address is required.'),
  body('pickupLocation.city').trim().notEmpty().withMessage('Pickup city is required.'),
  body('pickupLocation.state').trim().notEmpty().withMessage('Pickup state is required.'),
  body('pickupLocation.pincode').trim().notEmpty().withMessage('Pickup pincode is required.'),

  // Delivery Location
  body('deliveryLocation.address').trim().notEmpty().withMessage('Delivery address is required.'),
  body('deliveryLocation.city').trim().notEmpty().withMessage('Delivery city is required.'),
  body('deliveryLocation.state').trim().notEmpty().withMessage('Delivery state is required.'),
  body('deliveryLocation.pincode').trim().notEmpty().withMessage('Delivery pincode is required.'),

  // Goods
  body('goodsType').trim().notEmpty().withMessage('Goods type is required.'),
  body('weight')
    .notEmpty().withMessage('Weight is required.')
    .isFloat({ gt: 0 }).withMessage('Weight must be a positive number.'),

  // Optional
  body('description').optional().trim(),
  body('estimatedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Estimated delivery must be a valid date (ISO 8601).'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// @route   POST /api/shipments
// @desc    Create a new shipment request
// @access  Private — Shipper only
router.post('/', authorizeRoles('shipper'), createShipmentValidation, createShipment);

// @route   GET /api/shipments/my
// @desc    Get all shipments created by the logged-in shipper
// @access  Private — Shipper only
// NOTE: This route must be defined BEFORE /:id to avoid 'my' being
//       interpreted as a MongoDB ObjectId.
router.get('/my', authorizeRoles('shipper'), getMyShipments);

// @route   GET /api/shipments/:id
// @desc    Get single shipment by ID (with full statusHistory)
// @access  Private — All roles
router.get(
  '/:id',
  authorizeRoles('shipper', 'driver', 'admin'),
  validateObjectId(),
  getShipmentById
);

// @route   PATCH /api/shipments/:id/cancel
// @desc    Cancel a pending shipment (shipper only, own shipments)
// @access  Private — Shipper only
const cancelShipmentValidation = [
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters.'),
];
router.patch(
  '/:id/cancel',
  authorizeRoles('shipper'),
  validateObjectId(),
  idempotency(),
  cancelShipmentValidation,
  cancelShipment
);

module.exports = router;
