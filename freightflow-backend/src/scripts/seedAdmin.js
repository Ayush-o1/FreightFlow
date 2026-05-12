'use strict';

/**
 * Admin Seed Script
 * Creates the initial admin user if one does not already exist.
 *
 * Prerequisites:
 *   - .env file must exist at the project root with MONGODB_URI,
 *     ADMIN_EMAIL, and ADMIN_PASSWORD set.
 *
 * Usage:
 *   node src/scripts/seedAdmin.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

const seed = async () => {
  // ── Validate required env vars ────────────────────────────────────────────
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI is not set in .env');
    process.exit(1);
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌  ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  try {
    // ── Connect to MongoDB ────────────────────────────────────────────────────
    await mongoose.connect(MONGODB_URI);
    console.log('✅  Connected to MongoDB');

    // ── Check if admin already exists ─────────────────────────────────────────
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });

    if (existingAdmin) {
      console.log(`ℹ️   Admin already exists: ${existingAdmin.email}`);
      console.log('    No changes made.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ── Create admin user ─────────────────────────────────────────────────────
    // Password hashing is handled automatically by the User model pre-save hook
    const adminName = process.env.ADMIN_NAME || 'FreightFlow Admin';
    const admin = await User.create({
      name: adminName,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    });

    console.log('🚀  Admin user created successfully!');
    console.log(`    Name  : ${admin.name}`);
    console.log(`    Email : ${admin.email}`);
    console.log(`    Role  : ${admin.role}`);
    console.log(`    ID    : ${admin._id}`);
    console.log('');
    console.log('⚠️   Store these credentials securely. They will not be shown again.');

    await mongoose.disconnect();
    console.log('✅  Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌  Seed script failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seed();
