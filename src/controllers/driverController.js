'use strict';

const { validationResult } = require('express-validator');
const Shipment = require('../models/Shipment');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { getIO } = require('../utils/getIO');
const logger = require('../config/logger');
const {
  OK, BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNPROCESSABLE,
} = require('../utils/httpStatus');
const {
  notifyStatusUpdated,
  notifyDelivered,
} = require('../services/notificationService');

// ─── Status progression map (forward-only) ────────────────────────────────────
// Only statuses in this map are driver-updatable.
// Value is the ONLY valid next status from that key.
const STATUS_PROGRESSION = {
  assigned:   'picked_up',
  picked_up:  'in_transit',
  in_transit: 'delivered',
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ASSIGNED SHIPMENTS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/driver/shipments
 * Returns all shipments assigned to the authenticated driver.
 * Supports ?status= query param to filter by status.
 * Sorted by updatedAt descending.
 * Access: Driver only
 */
const getAssignedShipments = async (req, res, next) => {
  try {
    const { status } = req.query;

    const filter = { driver: req.user._id };

    if (status) {
      const validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return errorResponse(
          res,
          BAD_REQUEST,
          `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`
        );
      }
      filter.status = status;
    }

    const shipments = await Shipment.find(filter)
      .populate('shipper', 'name email')
      .sort({ updatedAt: -1 });

    return successResponse(res, OK, 'Assigned shipments retrieved successfully.', {
      count: shipments.length,
      shipments,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET SHIPMENT DETAIL (driver view)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/driver/shipments/:id
 * Returns full detail of a single shipment assigned to this driver.
 * Returns 403 if the shipment exists but belongs to a different driver.
 * Access: Driver only (own shipments)
 */
const getShipmentDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const shipment = await Shipment.findById(id)
      .populate('shipper', 'name email')
      .populate('statusHistory.updatedBy', 'name role');

    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    if (!shipment.driver || shipment.driver.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. This shipment is not assigned to you.'
      );
    }

    return successResponse(res, OK, 'Shipment retrieved successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE SHIPMENT STATUS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/driver/shipments/:id/status
 * Allows a driver to advance the delivery status of their shipment.
 *
 * Allowed transitions (strict forward-only):
 *   assigned → picked_up → in_transit → delivered
 *
 * Request body: { status, note? }
 * Access: Driver only (own shipments)
 */
const updateShipmentStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { id } = req.params;
    const { status: requestedStatus, note } = req.body;

    // 1. Validate that a status was provided
    if (!requestedStatus) {
      return errorResponse(res, BAD_REQUEST, 'Status is required.');
    }

    // 2. Find the shipment (no populate yet — we just need raw doc for update)
    const shipment = await Shipment.findById(id);

    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    // 3. Ownership check — must be assigned to this driver
    if (!shipment.driver || shipment.driver.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. This shipment is not assigned to you.'
      );
    }

    const currentStatus = shipment.status;

    // 4. Check that the current status is in a driver-updatable state
    if (!(currentStatus in STATUS_PROGRESSION)) {
      return errorResponse(
        res,
        BAD_REQUEST,
        `Shipment is not in an updatable state. Current status is '${currentStatus}'.`
      );
    }

    // 5. Enforce forward-only progression
    const allowedNextStatus = STATUS_PROGRESSION[currentStatus];
    if (requestedStatus !== allowedNextStatus) {
      return errorResponse(
        res,
        BAD_REQUEST,
        `Invalid status transition. From '${currentStatus}', the only allowed next status is '${allowedNextStatus}'.`
      );
    }

    // 6. Apply the status update and push to statusHistory
    const resolvedNote = note || `Status updated to ${requestedStatus} by driver.`;

    shipment.status = requestedStatus;
    shipment.statusHistory.push({
      status:    requestedStatus,
      updatedBy: req.user._id,
      note:      resolvedNote,
      timestamp: new Date(),
    });

    await shipment.save();

    // 7. Re-fetch with fully populated fields for the response
    const updatedShipment = await Shipment.findById(shipment._id)
      .populate('shipper', 'name email')
      .populate('driver',  'name email')
      .populate('statusHistory.updatedBy', 'name role');

    // 8. Emit real-time events to anyone watching this shipment room
    const io = getIO();
    if (io) {
      const room = `shipment_${id}`;

      io.to(room).emit('statusUpdated', {
        shipmentId: id,
        newStatus:  requestedStatus,
        updatedBy:  req.user.name,
        role:       req.user.role,
        note:       resolvedNote,
        timestamp:  new Date(),
      });
      logger.debug({ shipmentId: id, status: requestedStatus, room }, 'Emitted statusUpdated');

      if (requestedStatus === 'delivered') {
        io.to(room).emit('shipmentDelivered', {
          shipmentId: id,
          message:    'Your shipment has been delivered',
          timestamp:  new Date(),
        });
        logger.debug({ shipmentId: id, room }, 'Emitted shipmentDelivered');
      }
    }

    // 9. Mock email notifications (non-blocking, fire-and-forget)
    notifyStatusUpdated(updatedShipment, updatedShipment.shipper, requestedStatus);

    if (requestedStatus === 'delivered') {
      notifyDelivered(updatedShipment, updatedShipment.shipper);
    }

    return successResponse(res, OK, `Shipment status updated to '${requestedStatus}'.`, {
      shipment: updatedShipment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAssignedShipments, getShipmentDetail, updateShipmentStatus };
