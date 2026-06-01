'use strict';

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Shipment  = require('../models/Shipment');
const User      = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const {
  OK, BAD_REQUEST, NOT_FOUND, CONFLICT, FORBIDDEN, UNPROCESSABLE,
} = require('../utils/httpStatus');
const { recordAuditEvent } = require('../services/auditLogService');
const { getPagination, buildPaginationPayload } = require('../utils/pagination');
const { getAdminAnalytics, invalidateAnalyticsCache } = require('../services/analyticsService');
const {
  queueShipmentAssignedEvent,
  queueShipmentCancelledEvent,
  queueUserStatusNotification,
} = require('../services/shipmentEventService');

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
    const { status, search } = req.query;
    const { page, limit, skip } = getPagination(req.query);

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
      const matchedUsers = await User.find({ name: regex }, '_id').lean();
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
        .limit(limit)
        .lean(),
      Shipment.countDocuments(filter),
    ]);

    return successResponse(res, OK, 'Shipments retrieved successfully.', {
      ...buildPaginationPayload({ total, page, limit, count: shipments.length }),
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
    const { page, limit, skip } = getPagination(req.query, { limit: 20 });

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

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id name email role isActive createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return successResponse(res, OK, 'Users retrieved successfully.', {
      ...buildPaginationPayload({ total, page, limit, count: users.length }),
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
    const { page, limit, skip } = getPagination(req.query, { limit: 100 });
    const filter = { role: 'driver', isActive: true };

    const [drivers, total] = await Promise.all([
      User.find(filter)
      .select('_id name email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return successResponse(res, OK, 'Drivers retrieved successfully.', {
      ...buildPaginationPayload({ total, page, limit, count: drivers.length }),
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { id }       = req.params;
    const { driverId, note } = req.body;

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

    const shipment = await Shipment.findOneAndUpdate(
      { _id: id, status: 'pending' },
      {
        $set: {
          driver: driverId,
          status: 'assigned',
        },
        $push: {
          statusHistory: {
            status: 'assigned',
            updatedBy: req.user._id,
            note: note?.trim() || 'Driver assigned by admin',
            timestamp: new Date(),
          },
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );

    if (!shipment) {
      const existingShipment = await Shipment.findById(id).select('status').lean();
      if (!existingShipment) {
        return errorResponse(res, NOT_FOUND, 'Shipment not found.');
      }
      return errorResponse(
        res, CONFLICT,
        `Cannot assign a driver to a shipment with status '${existingShipment.status}'. Only 'pending' shipments can be assigned.`
      );
    }

    await shipment.populate('shipper', 'name email');
    await shipment.populate('driver',  'name email');

    await queueShipmentAssignedEvent(shipment, driver, req);
    await invalidateAnalyticsCache();

    recordAuditEvent(req, {
      action: 'shipment.assigned',
      targetType: 'Shipment',
      targetId: shipment._id,
      metadata: {
        driverId,
        previousStatus: 'pending',
        newStatus: 'assigned',
      },
    });

    return successResponse(res, OK, 'Driver assigned successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CANCEL SHIPMENT (Admin)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/shipments/:id/cancel
 * Admin can cancel any non-cancelled shipment. Existing shipment records remain
 * intact; only status and statusHistory are updated.
 *
 * Body: { note? }
 * Access: Admin only
 */
const cancelShipmentAsAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { id } = req.params;
    const { note } = req.body;

    const resolvedNote = note?.trim() || 'Shipment cancelled by admin.';

    const existingShipment = await Shipment.findById(id).select('status').lean();
    if (!existingShipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }
    if (existingShipment.status === 'cancelled') {
      return errorResponse(res, BAD_REQUEST, 'Shipment is already cancelled.');
    }

    const previousStatus = existingShipment.status;

    const updatedShipment = await Shipment.findOneAndUpdate(
      { _id: id, status: { $ne: 'cancelled' } },
      {
        $set: { status: 'cancelled' },
        $push: {
          statusHistory: {
            status: 'cancelled',
            updatedBy: req.user._id,
            note: resolvedNote,
            timestamp: new Date(),
          },
        },
      },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('shipper', 'name email')
      .populate('driver', 'name email')
      .populate('statusHistory.updatedBy', 'name role');

    if (!updatedShipment) {
      return errorResponse(res, CONFLICT, 'Shipment status changed before cancellation could be applied.');
    }

    await queueShipmentCancelledEvent(updatedShipment, req, {
      previousStatus,
      cancelledBy: 'admin',
      note: resolvedNote,
    });
    await invalidateAnalyticsCache();

    recordAuditEvent(req, {
      action: 'shipment.cancelled',
      targetType: 'Shipment',
      targetId: updatedShipment._id,
      metadata: {
        cancelledBy: 'admin',
        previousStatus,
        newStatus: 'cancelled',
      },
    });

    return successResponse(res, OK, 'Shipment cancelled successfully.', {
      shipment: updatedShipment,
    });
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
    const { analytics, cache } = await getAdminAnalytics();

    return successResponse(res, OK, 'Analytics retrieved successfully.', {
      ...analytics,
      cache,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
//  UPDATE USER STATUS (Admin)
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/admin/users/:id/status
 * Activate or deactivate a user account.
 *
 * Business rules:
 *   - Admin cannot deactivate their own account
 *   - Deactivating a user also nulls their refreshToken (forces session invalidation)
 *   - Reactivating a user does not issue a new session — they must log in again
 *
 * Body: { isActive: boolean }
 * Access: Admin only
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { id }      = req.params;
    const { isActive } = req.body;

    // Guard: admin cannot deactivate themselves
    if (id === req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'You cannot change the status of your own account.'
      );
    }

    const update = {
      isActive,
    };
    if (!isActive) {
      update.refreshToken = null;
    }

    const user = await User.findOneAndUpdate(
      { _id: id, isActive: { $ne: isActive } },
      { $set: update },
      { returnDocument: 'after', runValidators: false }
    ).select('_id name email role isActive createdAt updatedAt');

    if (!user) {
      const existingUser = await User.findById(id).select('_id isActive').lean();
      if (!existingUser) {
        return errorResponse(res, NOT_FOUND, 'User not found.');
      }
      const stateLabel = isActive ? 'active' : 'inactive';
      return errorResponse(
        res,
        BAD_REQUEST,
        `User account is already ${stateLabel}.`
      );
    }

    await queueUserStatusNotification(user, req);
    await invalidateAnalyticsCache();
    recordAuditEvent(req, {
      action: isActive ? 'admin.user_activated' : 'admin.user_deactivated',
      targetType: 'User',
      targetId: user._id,
      metadata: {
        targetRole: user.role,
        isActive,
      },
    });

    // Return a safe user object (password + refreshToken excluded by select:false)
    const safeUser = {
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      isActive:  user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const action = isActive ? 'activated' : 'deactivated';
    return successResponse(res, OK, `User account ${action} successfully.`, { user: safeUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllShipments,
  getAllUsers,
  getAllDrivers,
  assignDriver,
  cancelShipmentAsAdmin,
  getShipmentById,
  getAnalytics,
  updateUserStatus,
};
