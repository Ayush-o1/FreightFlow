'use strict';

const mongoose = require('mongoose');

// ─── Payment Schema ───────────────────────────────────────────────────────────
const paymentSchema = new mongoose.Schema(
  {
    // One payment per shipment — enforced by unique index
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: [true, 'Shipment reference is required'],
      unique: true,
    },

    shipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Shipper reference is required'],
    },

    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be a positive number'],
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed'],
        message: "Payment status must be one of: pending, paid, failed",
      },
      default: 'pending',
    },

    // Populated only after a successful simulated payment
    transactionId: {
      type: String,
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ['card', 'upi', 'netbanking'],
        message: "Payment method must be one of: card, upi, netbanking",
      },
      default: 'card',
    },

    // Populated only when status transitions to 'paid'
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─── Transform: Remove __v ────────────────────────────────────────────────────
paymentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
