'use strict';

const { validationResult } = require('express-validator');
const Shipment = require('../models/Shipment');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { OK, CREATED, BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNPROCESSABLE } = require('../utils/httpStatus');
const { notifyShipmentCreated } = require('../services/notificationService');
const { getIO } = require('../utils/getIO');
const { recordAuditEvent } = require('../services/auditLogService');

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE SHIPMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/shipments
 * Creates a new shipment request.
 * Access: Shipper only
 */
const createShipment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const {
      pickupLocation,
      deliveryLocation,
      goodsType,
      weight,
      description,
      estimatedDelivery,
    } = req.body;

    const initialHistory = {
      status:    'pending',
      updatedBy: req.user._id,
      note:      'Shipment created',
      timestamp: new Date(),
    };

    const shipment = await Shipment.create({
      shipper:          req.user._id,
      pickupLocation,
      deliveryLocation,
      goodsType,
      weight,
      description:      description || '',
      estimatedDelivery: estimatedDelivery || null,
      status:           'pending',
      statusHistory:    [initialHistory],
    });

    // Fire-and-forget mock notification (non-blocking)
    notifyShipmentCreated(shipment, req.user);

    return successResponse(res, CREATED, 'Shipment created successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET MY SHIPMENTS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/shipments/my
 * Returns all shipments belonging to the authenticated shipper.
 * Supports ?status= query param to filter.
 * Access: Shipper only
 */
const getMyShipments = async (req, res, next) => {
  try {
    const { status } = req.query;

    const filter = { shipper: req.user._id };

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
      .populate('driver', 'name email')
      .sort({ createdAt: -1 });

    return successResponse(res, OK, 'Shipments retrieved successfully.', {
      count: shipments.length,
      shipments,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET SHIPMENT BY ID
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/shipments/:id
 * Returns a single shipment with full details including statusHistory.
 * - Shipper can only view their own shipments
 * - Driver and Admin can view any shipment
 * Access: All authenticated roles (ownership enforced per role)
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

    if (
      req.user.role === 'shipper' &&
      shipment.shipper._id.toString() !== req.user._id.toString()
    ) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. You can only view your own shipments.'
      );
    }

    return successResponse(res, OK, 'Shipment retrieved successfully.', { shipment });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────────
//  CANCEL SHIPMENT
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/shipments/:id/cancel
 * Allows a shipper to cancel their own shipment.
 *
 * Business rules:
 *   - Only the owning shipper can cancel (ownership checked by comparing shipper field)
 *   - Only 'pending' shipments can be cancelled (once a driver is assigned, dispatch has begun)
 *   - Appends a statusHistory entry and emits a socket 'statusUpdated' event
 *
 * Request body (optional): { note }
 * Access: Shipper only (own shipments)
 */
const cancelShipment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { id }  = req.params;
    const { note } = req.body;

    const shipment = await Shipment.findById(id);

    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    // Ownership check — only the shipper who created it can cancel
    if (shipment.shipper.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. You can only cancel your own shipments.'
      );
    }

    // State guard — only pending shipments can be cancelled
    if (shipment.status !== 'pending') {
      return errorResponse(
        res,
        BAD_REQUEST,
        `Only 'pending' shipments can be cancelled. Current status is '${shipment.status}'.`
      );
    }

    const resolvedNote = note?.trim() || 'Shipment cancelled by shipper.';

    const previousStatus = shipment.status;

    shipment.status = 'cancelled';
    shipment.statusHistory.push({
      status:    'cancelled',
      updatedBy: req.user._id,
      note:      resolvedNote,
      timestamp: new Date(),
    });

    await shipment.save();

    // Re-fetch fully populated for the response
    const updatedShipment = await Shipment.findById(shipment._id)
      .populate('shipper', 'name email')
      .populate('driver',  'name email')
      .populate('statusHistory.updatedBy', 'name role');

    // Emit real-time update to anyone watching this shipment room
    const io = getIO();
    if (io) {
      io.to(`shipment_${id}`).emit('statusUpdated', {
        shipmentId: id,
        previousStatus,
        newStatus:  'cancelled',
        updatedBy:  req.user.name,
        role:       req.user.role,
        note:       resolvedNote,
        timestamp:  new Date(),
      });
    }

    recordAuditEvent(req, {
      action: 'shipment.cancelled',
      targetType: 'Shipment',
      targetId: shipment._id,
      metadata: {
        cancelledBy: 'shipper',
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

module.exports = { createShipment, getMyShipments, getShipmentById, cancelShipment };
