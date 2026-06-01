'use strict';

const mongoose = require('mongoose');
const logger = require('../config/logger');
const { getIO, clearIO } = require('./getIO');
const { disconnectRedis } = require('../config/redis');
const { closeQueues } = require('../queues');
const { stopWorkers } = require('../workers');

const closeServer = (server) =>
  new Promise((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });

const closeSocket = async () => {
  const io = getIO();
  if (!io) return;

  await new Promise((resolve) => io.close(resolve));
  clearIO();
};

const shutdown = async ({ server, signal = 'shutdown', exit = true } = {}) => {
  logger.info({ signal }, 'Shutdown started');

  try {
    await closeSocket();
    await stopWorkers();
    await closeQueues();
    await closeServer(server);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await disconnectRedis();

    logger.info({ signal }, 'Shutdown complete');
    if (exit) process.exit(0);
  } catch (error) {
    logger.error({ err: error, signal }, 'Shutdown failed');
    if (exit) process.exit(1);
  }
};

module.exports = {
  shutdown,
};
