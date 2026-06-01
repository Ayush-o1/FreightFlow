'use strict';

const mongoose = require('mongoose');
const Payment  = require('../models/Payment');
const Shipment = require('../models/Shipment');
const { generateMockTransactionId } = require('../services/paymentService');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const {
  OK, CREATED, BAD_REQUEST, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE,
} = require('../utils/httpStatus');

// ─── Valid payment methods ─────────────────────────────────────────────────────
const VALID_PAYMENT_METHODS = ['card', 'upi', 'netbanking'];

// ─────────────────────────────────────────────────────────────────────────────
//  INITIATE PAYMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/payments/initiate/:shipmentId
 * Creates a new pending payment record for a shipment.
 *
 * Atomicity guarantee (Mongoose transaction):
 *   Payment.create() + Shipment.paymentStatus update run in one atomic transaction.
 *   If either operation fails, both are rolled back — eliminating paymentStatus drift
 *   where a payment row exists but the shipment still reads 'unpaid' (or vice versa).
 *
 * Requirements: MongoDB replica set (or mongos). Standalone instances don't support
 *   multi-document transactions. In that case, the catch block re-aborts and re-throws.
 *
 * Access: Shipper only (own shipments)
 */
const initiatePayment = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { shipmentId } = req.params;
    const { amount, paymentMethod } = req.body;

    // 1. Validate amount
    if (amount === undefined || amount === null || amount === '') {
      return errorResponse(res, UNPROCESSABLE, 'Amount is required.');
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return errorResponse(res, UNPROCESSABLE, 'Amount must be a positive number.');
    }

    // 2. Validate paymentMethod
    if (!paymentMethod) {
      return errorResponse(res, UNPROCESSABLE, 'Payment method is required.');
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return errorResponse(
        res,
        UNPROCESSABLE,
        `Invalid payment method. Must be one of: ${VALID_PAYMENT_METHODS.join(', ')}.`
      );
    }

    // 3. Validate shipment exists
    const shipment = await Shipment.findById(shipmentId).session(session);
    if (!shipment) {
      return errorResponse(res, NOT_FOUND, 'Shipment not found.');
    }

    // 4. Validate the shipment belongs to this shipper
    if (shipment.shipper.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. You can only initiate payment for your own shipments.'
      );
    }

    // 5. Check if a payment already exists for this shipment
    const existingPayment = await Payment.findOne({ shipment: shipmentId }).session(session);
    if (existingPayment) {
      return errorResponse(
        res,
        CONFLICT,
        'A payment has already been initiated for this shipment.'
      );
    }

    // 6. Atomic: create payment record + sync shipment.paymentStatus in one transaction
    let payment;
    await session.withTransaction(async () => {
      // Payment.create with session returns an array — destructure the first element
      [payment] = await Payment.create(
        [
          {
            shipment:      shipmentId,
            shipper:       req.user._id,
            amount:        parsedAmount,
            paymentMethod,
            status:        'pending',
          },
        ],
        { session }
      );

      await Shipment.findByIdAndUpdate(
        shipmentId,
        { paymentStatus: 'pending' },
        { session }
      );
    });

    return successResponse(res, CREATED, 'Payment initiated successfully.', { payment });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIRM PAYMENT (SIMULATE SUCCESS / FAILURE)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/payments/confirm/:paymentId
 * Simulates payment confirmation — succeeds or fails based on body.simulate.
 *
 * Atomicity guarantee (Mongoose transaction):
 *   payment.save() + Shipment.paymentStatus update run atomically.
 *   If either fails, both roll back — paymentStatus on Shipment always matches
 *   the Payment.status (eliminates the drift where Payment says 'paid' but
 *   Shipment.paymentStatus still reads 'pending').
 *
 * Body: { simulate: 'success' | 'failure' }
 * Access: Shipper only (own payments)
 */
const confirmPayment = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { paymentId } = req.params;
    const { simulate }  = req.body;

    // 1. Validate simulate value
    if (!simulate || !['success', 'failure'].includes(simulate)) {
      return errorResponse(
        res,
        UNPROCESSABLE,
        "Field 'simulate' is required and must be 'success' or 'failure'."
      );
    }

    // 2. Find the payment
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      return errorResponse(res, NOT_FOUND, 'Payment record not found.');
    }

    // 3. Ownership check
    if (payment.shipper.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Access denied. This payment does not belong to you.'
      );
    }

    // 4. Guard: can only confirm a pending payment
    if (payment.status !== 'pending') {
      return errorResponse(
        res,
        BAD_REQUEST,
        `Payment cannot be confirmed. Current status is '${payment.status}'.`
      );
    }

    // 5. Atomic update — payment status + shipment paymentStatus in one transaction
    await session.withTransaction(async () => {
      if (simulate === 'success') {
        payment.status        = 'paid';
        payment.transactionId = generateMockTransactionId();
        payment.paidAt        = new Date();
      } else {
        payment.status = 'failed';
      }
      await payment.save({ session });

      const newPaymentStatus = simulate === 'success' ? 'paid' : 'failed';
      await Shipment.findByIdAndUpdate(
        payment.shipment,
        { paymentStatus: newPaymentStatus },
        { session }
      );
    });

    const message = simulate === 'success'
      ? 'Payment confirmed successfully.'
      : 'Payment simulation failed as requested.';

    return successResponse(res, OK, message, { payment });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET PAYMENT BY SHIPMENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/payments/:shipmentId
 * Returns the payment record for a given shipment.
 * - Shipper: can only view payment for their own shipment
 * - Admin: can view any shipment's payment
 * Access: Shipper (own) | Admin (any)
 */
const getPaymentByShipment = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;

    const payment = await Payment.findOne({ shipment: shipmentId }).populate(
      'shipment',
      '_id status goodsType pickupLocation deliveryLocation'
    );

    if (!payment) {
      return errorResponse(res, NOT_FOUND, 'No payment record found for this shipment.');
    }

    if (req.user.role === 'shipper') {
      if (payment.shipper.toString() !== req.user._id.toString()) {
        return errorResponse(
          res,
          FORBIDDEN,
          'Access denied. You can only view payment for your own shipments.'
        );
      }
    }

    return successResponse(res, OK, 'Payment retrieved successfully.', { payment });
  } catch (error) {
    next(error);
  }
};

module.exports = { initiatePayment, confirmPayment, getPaymentByShipment };
