'use strict';

const mongoose = require('mongoose');

/**
 * Establishes a connection to MongoDB using the URI defined in environment variables.
 * Logs a clear success or failure message.
 * The function is async and resolves on success, rejects on failure —
 * allowing server.js to handle the failure gracefully.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. ' +
      'Please set it in your .env file.'
    );
  }

  try {
    const connection = await mongoose.connect(uri, {
      // These options are the defaults in Mongoose 6+ but are explicit here
      // for clarity and future-proofing
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if no server found
      socketTimeoutMS: 45000,         // Close sockets after 45s of inactivity
    });

    console.log(
      `✅  MongoDB connected successfully → Host: ${connection.connection.host}`
    );
  } catch (error) {
    console.error('❌  MongoDB connection failed:', error.message);
    // Re-throw so server.js can catch and exit cleanly
    throw error;
  }
};

// Listen for disconnection events after initial connection
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄  MongoDB reconnected successfully.');
});

module.exports = connectDB;
