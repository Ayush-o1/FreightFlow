'use strict';

const mongoose = require('mongoose');
const Shipment  = require('../models/Shipment');
const Payment   = require('../models/Payment');
const User      = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { getIO } = require('../utils/getIO');
const {
  OK, BAD_REQUEST, NOT_FOUND, CONFLICT,
} = require('../utils/httpStatus');
const { notifyDriverAssigned } = require('../services/notificationService');

/**
 * Escapes all regex metacharacters in a string so it is safe to pass
 * to `new RegExp()` without creating a ReDoS vulnerability.
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─────────────────────────────────────────────────────────────────────────────
//  GET ALL SHIPMENTS  (with filter, search, pagination)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/shipments
 * Query params:
 *   ?status=pending|assigned|picked_up|in_transit|delivered|cancelled
 *   ?search=<keyword>  (matches shipper name, driver name, goodsType)
 *   ?page=1&limit=10
 * Access: Admin only
 */
const getAllShipments = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip     = (pageNum - 1) * limitNum;

    const filter = {};

    const validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (status) {
      if (!validStatuses.includes(status)) {
        return errorResponse(
          res, BAD_REQUEST,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
      }
      filter.status = status;
    }

    if (search) {
      const safeSearch   = escapeRegex(String(search).trim());
      const regex        = new RegExp(safeSearch, 'i');
      const matchedUsers = await User.find({ name: regex }, '_id');
      const matchedIds   = matchedUsers.map((u) => u._id);

      filter.$or = [
        { goodsType: regex },
        { shipper:   { $in: matchedIds } },
        { driver:    { $in: matchedIds } },
      ];
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(filter)
        .populate('shipper', 'name email')
        .populate('driver',  'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Shipment.countDocuments(filter),
    ]);

    return successResponse(res, OK, 'Shipments retrieved successfully.', {
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limitNum),
      count:      shipments.length,
      shipments,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ALL USERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/users
 * Query params: ?role=driver|shipper|admin
 * Access: Admin only
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;

    const filter     = {};
    const validRoles = ['shipper', 'driver', 'admin'];

    if (role) {
      if (!validRoles.includes(role)) {
        return errorResponse(
          res, BAD_REQUEST,
          `Invalid role filter. Must be one of: ${validRoles.join(', ')}`
        );
      }
      filter.role = role;
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    return successResponse(res, OK, 'Users retrieved successfully.', {
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ALL DRIVERS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/drivers
 * Returns only drivers with id, name, email — lightweight for dropdowns.
 * Access: Admin only
 */
const getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await User.find({ role: 'driver', isActive: true })
      .select('_id name email')
      .sort({ name: 1 });

    return successResponse(res, OK, 'Drivers retrieved successfully.', {
      count: drivers.length,
      drivers,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  ASSIGN DRIVER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/shipments/:id/assign
 * Body: { driverId, note? }
 * Access: Admin only
 */
const assignDriver = async (req, res, next) => {
  try {
    const { id }       = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return errorResponse(res, BAD_REQUEST, 'driverId is required in the request body.');
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return errorResponse(res, BAD_REQUEST, 'Invalid driverId format.');
    }

    const driver = await User.findById(driverId);

    if (!driver) {
      return errorResponse(res, NOT_FOUND, 'Driver not found.');
    }

    if (driver.role !== 'driver') {
      return errorResponse(
        res, BAD_REQUEST,
        `User "${driver.name}" is not a driver. Only users with role 'driver' can be assigned.`
      );
    }

    if (!driver.isActive) {
      return errorResponse(res, BAD_REQUEST, 'Cannot assign an inactive driver.');
    }

    const shipment = await Shipment.findById(id);

    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    if (shipment.status !== 'pending') {
      return errorResponse(
        res, CONFLICT,
        `Cannot assign a driver to a shipment with status '${shipment.status}'. Only 'pending' shipments can be assigned.`
      );
    }

    shipment.driver = driverId;
    shipment.status = 'assigned';
    shipment.statusHistory.push({
      status:    'assigned',
      updatedBy: req.user._id,
      note:      'Driver assigned by admin',
      timestamp: new Date(),
    });

    await shipment.save();

    await shipment.populate('shipper', 'name email');
    await shipment.populate('driver',  'name email');

    // ── Real-time Socket.io emit ──────────────────────────────────────────────
    const io = getIO();
    if (io) {
      io.to(`shipment_${id}`).emit('driverAssigned', {
        shipmentId: id,
        driverId,
        driverName: driver.name,
        status:     'assigned',
        message:    'A driver has been assigned to your shipment',
        timestamp:  new Date(),
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📡  Emitted driverAssigned → room: shipment_${id}`);
      }
    }

    // ── Mock email notification ───────────────────────────────────────────────
    notifyDriverAssigned(shipment, shipment.shipper, driver);

    return successResponse(res, OK, 'Driver assigned successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET SINGLE SHIPMENT (Admin)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/shipments/:id
 * Admin can view any shipment with full statusHistory.
 * Access: Admin only
 */
const getShipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const shipment = await Shipment.findById(id)
      .populate('shipper', 'name email')
      .populate('driver',  'name email')
      .populate('statusHistory.updatedBy', 'name role');

    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    return successResponse(res, OK, 'Shipment retrieved successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ANALYTICS  (Phase 8)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/analytics
 * Returns platform-wide summary statistics.
 * Access: Admin only
 */
const getAnalytics = async (req, res, next) => {
  try {
    // Run all queries in parallel for speed
    const [
      totalShipments,
      shipmentStatusAgg,
      totalShippers,
      totalDrivers,
      revenueAgg,
      recentShipments,
    ] = await Promise.all([
      // 1. Total shipment count
      Shipment.countDocuments(),

      // 2. Shipments grouped by status
      Shipment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // 3. Total shippers
      User.countDocuments({ role: 'shipper' }),

      // 4. Total drivers
      User.countDocuments({ role: 'driver' }),

      // 5. Total revenue from paid payments
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // 6. Last 5 shipments with shipper info
      Shipment.find({})
        .populate('shipper', 'name email')
        .select('_id goodsType status createdAt shipper')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    // Normalise status aggregation into a fixed-shape object
    const shipmentsByStatus = {
      pending:    0,
      assigned:   0,
      picked_up:  0,
      in_transit: 0,
      delivered:  0,
      cancelled:  0,
    };
    shipmentStatusAgg.forEach(({ _id, count }) => {
      if (_id in shipmentsByStatus) shipmentsByStatus[_id] = count;
    });

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return successResponse(res, OK, 'Analytics retrieved successfully.', {
      totalShipments,
      shipmentsByStatus,
      totalShippers,
      totalDrivers,
      totalRevenue,
      recentShipments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllShipments,
  getAllUsers,
  getAllDrivers,
  assignDriver,
  getShipmentById,
  getAnalytics,
};
