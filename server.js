'use strict';

const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config();

const http = require('http');
const { validateEnv } = require('./src/config/env');
const logger = require('./src/config/logger');
const app  = require('./src/app');
const connectDB    = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');
const { shutdown } = require('./src/utils/shutdown');

const env = validateEnv();
const PORT = env.PORT;

// Create HTTP server (Socket.io will attach to this in a later phase)
const server = http.createServer(app);

// Boot sequence
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Socket.io (must happen after DB is ready, before listen)
    initSocket(server);

    // 3. Start listening
    server.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          environment: process.env.NODE_ENV || 'development',
        },
        'FreightFlow API server running'
      );
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  shutdown({ server, signal: 'unhandledRejection' });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  shutdown({ server, signal: 'uncaughtException' });
});

// Graceful shutdown on SIGTERM (e.g. from Docker / Render / Railway)
process.on('SIGTERM', () => {
  shutdown({ server, signal: 'SIGTERM' });
});

process.on('SIGINT', () => {
  shutdown({ server, signal: 'SIGINT' });
});

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer };
