'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

const STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Establishes a connection to MongoDB using the URI defined in environment variables.
 * Logs a clear success or failure message.
 * The function is async and resolves on success, rejects on failure —
 * allowing server.js to handle the failure gracefully.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI or MONGO_URI is not defined in environment variables. ' +
      'Please set one in your .env file.'
    );
  }

  try {
    const connection = await mongoose.connect(uri, {
      // These options are the defaults in Mongoose 6+ but are explicit here
      // for clarity and future-proofing
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if no server found
      socketTimeoutMS: 45000,         // Close sockets after 45s of inactivity
    });

    logger.info({ host: connection.connection.host }, 'MongoDB connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    // Re-throw so server.js can catch and exit cleanly
    throw error;
  }
};

// Listen for disconnection events after initial connection
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Mongoose will attempt to reconnect.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully.');
});

const getMongoReadiness = () => {
  const state = mongoose.connection.readyState;

  return {
    ready: state === 1,
    state,
    stateLabel: STATE_LABELS[state] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

module.exports = connectDB;
module.exports.getMongoReadiness = getMongoReadiness;
