'use strict';

const mongoose = require('mongoose');

// ─── Sub-schema: Location ─────────────────────────────────────────────────────
const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },
  },
  { _id: false } // No separate _id for embedded subdocuments
);

// ─── Sub-schema: Status History Entry ────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─── Main Shipment Schema ─────────────────────────────────────────────────────
const shipmentSchema = new mongoose.Schema(
  {
    shipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Shipper is required'],
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pickupLocation: {
      type: locationSchema,
      required: [true, 'Pickup location is required'],
    },
    deliveryLocation: {
      type: locationSchema,
      required: [true, 'Delivery location is required'],
    },
    goodsType: {
      type: String,
      required: [true, 'Goods type is required'],
      trim: true,
      // Examples: 'Electronics', 'Furniture', 'Perishables', 'Machinery', etc.
    },
    weight: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [0.1, 'Weight must be greater than 0'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
        message: "Status must be one of: pending, assigned, picked_up, in_transit, delivered, cancelled",
      },
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['unpaid', 'paid', 'failed'],
        message: "Payment status must be one of: unpaid, paid, failed",
      },
      default: 'unpaid',
    },
    estimatedDelivery: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Speeds up shipper's "my shipments" query and admin's status filter queries
shipmentSchema.index({ shipper: 1, createdAt: -1 });
shipmentSchema.index({ driver: 1, status: 1 });
shipmentSchema.index({ status: 1 });

// ─── Transform: Remove __v ────────────────────────────────────────────────────
shipmentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Shipment = mongoose.model('Shipment', shipmentSchema);

module.exports = Shipment;
