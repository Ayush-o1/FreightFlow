'use strict';

const express = require('express');
const { body } = require('express-validator');
const {
  getAssignedShipments,
  getShipmentDetail,
  updateShipmentStatus,
} = require('../controllers/driverController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const validateObjectId            = require('../middlewares/validateObjectId');

const router = express.Router();

// ─── All driver routes: must be authenticated AND have role 'driver' ──────────
router.use(protect);
router.use(authorizeRoles('driver'));

// @route   GET /api/driver/shipments
// @desc    Get all shipments assigned to this driver; supports ?status= filter
// @access  Driver only
router.get('/shipments', getAssignedShipments);

// @route   GET /api/driver/shipments/:id
// @desc    Get full detail of a single shipment assigned to this driver
// @access  Driver only
router.get('/shipments/:id', validateObjectId(), getShipmentDetail);

// @route   PATCH /api/driver/shipments/:id/status
// @desc    Advance shipment delivery status (assigned→picked_up→in_transit→delivered)
// @access  Driver only
const updateStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required.')
    .isIn(['picked_up', 'in_transit', 'delivered'])
    .withMessage("Status must be one of: 'picked_up', 'in_transit', 'delivered'."),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters.'),
];
router.patch('/shipments/:id/status', validateObjectId(), updateStatusValidation, updateShipmentStatus);

module.exports = router;
