'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ['shipper', 'driver', 'admin'],
        message: "Role must be one of: 'shipper', 'driver', 'admin'",
      },
      default: 'shipper',
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    refreshToken: {
      type:    String,
      default: null,
      select:  false, // Never returned in queries — contains SHA-256 hash of raw refresh token
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ─── Pre-save Hook: Hash Password ────────────────────────────────────────────
// Only runs when the password field has been modified (handles updates too)
// NOTE: Mongoose v8 async hooks must NOT call next() — return early or throw.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
/**
 * Compares a plain-text candidate password against the stored hash.
 * Must be called on a user document fetched with .select('+password').
 *
 * @param {string} candidatePassword - The plain-text password to verify
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Indexes ──────────────────────────────────────────────────────────────────
// email is already unique-indexed via the field definition above.
// Compound index for admin/driver-assignment queries that filter by role + isActive.
// Covers: GET /api/admin/drivers (role:'driver', isActive:true)
userSchema.index({ role: 1, isActive: 1 });
userSchema.index(
  { refreshToken: 1 },
  { partialFilterExpression: { refreshToken: { $type: 'string' } } }
);

// ─── Transform: Remove __v from JSON output ───────────────────────────────────
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
