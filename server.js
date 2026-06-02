'use strict';

const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config();

const { initTracing } = require('./src/config/tracing');

initTracing();

const http = require('http');
const { validateEnv } = require('./src/config/env');
const logger = require('./src/config/logger');
const app  = require('./src/app');
const connectDB    = require('./src/config/db');
const { connectRedis } = require('./src/config/redis');
const { initSocket } = require('./src/services/socketService');
const { shutdown } = require('./src/utils/shutdown');
const { startWorkers } = require('./src/workers');

const env = validateEnv();
const PORT = env.PORT;

// Create HTTP server (Socket.io will attach to this in a later phase)
const server = http.createServer(app);

// Boot sequence
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Connect distributed infrastructure
    await connectRedis();

    // 3. Initialize Socket.io (must happen after DB/Redis are ready, before listen)
    await initSocket(server);

    // 4. Start in-process workers for this monolith deployment mode
    if (env.QUEUE_WORKERS_ENABLED) {
      await startWorkers();
    }

    // 5. Start listening
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
