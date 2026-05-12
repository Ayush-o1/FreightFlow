'use strict';

const express = require('express');
const {
  getAllShipments,
  getAllUsers,
  getAllDrivers,
  assignDriver,
  getShipmentById,
  getAnalytics,
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
router.patch('/shipments/:id/assign', validateObjectId(), assignDriver);

// ─── User Routes ──────────────────────────────────────────────────────────────

// @route   GET /api/admin/users
// @desc    Get all users — supports ?role=driver|shipper|admin
// @access  Admin only
router.get('/users', getAllUsers);

// @route   GET /api/admin/drivers
// @desc    Get all active drivers (lightweight, for dropdown population)
// @access  Admin only
router.get('/drivers', getAllDrivers);

module.exports = router;
