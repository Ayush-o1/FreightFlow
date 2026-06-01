'use strict';

const express = require('express');
const { body } = require('express-validator');
const {
  getAllShipments,
  getAllUsers,
  getAllDrivers,
  assignDriver,
  cancelShipmentAsAdmin,
  getShipmentById,
  getAnalytics,
  updateUserStatus,
} = require('../controllers/adminController');
const { protect, authorizeRoles } = require('../middlewares/auth');
const validateObjectId            = require('../middlewares/validateObjectId');

const router = express.Router();

// ─── All admin routes: must be authenticated AND have role 'admin' ────────────
router.use(protect);
router.use(authorizeRoles('admin'));

// ─── Analytics ────────────────────────────────────────────────────────────────

// @route   GET /api/admin/analytics
// @desc    Platform-wide summary: totals, revenue, recent shipments
// @access  Admin only
router.get('/analytics', getAnalytics);

// ─── Shipment Routes ──────────────────────────────────────────────────────────

// @route   GET /api/admin/shipments
// @desc    Get all shipments — supports ?status= ?search= ?page= ?limit=
// @access  Admin only
router.get('/shipments', getAllShipments);

// @route   GET /api/admin/shipments/:id
// @desc    Get a single shipment with full details
// @access  Admin only
// NOTE: Specific sub-routes like /shipments must come BEFORE /:id routes.
router.get('/shipments/:id', validateObjectId(), getShipmentById);

// @route   PATCH /api/admin/shipments/:id/assign
// @desc    Assign a driver to a pending shipment
// @access  Admin only
const assignDriverValidation = [
  body('driverId')
    .notEmpty()
    .withMessage('driverId is required.')
    .isMongoId()
    .withMessage('driverId must be a valid MongoDB ObjectId.'),
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters.'),
];
router.patch('/shipments/:id/assign', validateObjectId(), assignDriverValidation, assignDriver);

// @route   PATCH /api/admin/shipments/:id/cancel
// @desc    Cancel any non-cancelled shipment
// @access  Admin only
const cancelShipmentValidation = [
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters.'),
];
router.patch(
  '/shipments/:id/cancel',
  validateObjectId(),
  cancelShipmentValidation,
  cancelShipmentAsAdmin
);

// ─── User Routes ──────────────────────────────────────────────────────────────

// @route   GET /api/admin/users
// @desc    Get all users — supports ?role=driver|shipper|admin
// @access  Admin only
router.get('/users', getAllUsers);

// @route   GET /api/admin/drivers
// @desc    Get all active drivers (lightweight, for dropdown population)
// @access  Admin only
router.get('/drivers', getAllDrivers);

// @route   PATCH /api/admin/users/:id/status
// @desc    Activate or deactivate a user account
//          Deactivating also invalidates the user's refresh token (forces re-login)
//          Admin cannot deactivate their own account
// @access  Admin only
const updateUserStatusValidation = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required.')
    .isBoolean()
    .withMessage('isActive must be a boolean (true or false).')
    .toBoolean(),
];
router.patch('/users/:id/status', validateObjectId(), updateUserStatusValidation, updateUserStatus);

module.exports = router;
