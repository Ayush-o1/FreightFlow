'use strict';

const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config();

const http = require('http');
const app  = require('./src/app');
const connectDB    = require('./src/config/db');
const { initSocket } = require('./src/services/socketService');

const PORT = process.env.PORT || 5001;

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
      console.log('================================================');
      console.log(`  🚚  FreightFlow API Server`);
      console.log(`  🌍  Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`  🔌  Port        : ${PORT}`);
      console.log(`  ✅  Status      : Running`);
      console.log('================================================');
    });
  } catch (error) {
    console.error('❌  Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥  Unhandled Promise Rejection at:', promise);
  console.error('    Reason:', reason);
  // Gracefully shut down the server before exiting
  server.close(() => {
    console.error('💀  Server shut down due to unhandled rejection.');
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔥  Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

// Graceful shutdown on SIGTERM (e.g. from Docker / Render / Railway)
process.on('SIGTERM', () => {
  console.log('🛑  SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅  HTTP server closed.');
    process.exit(0);
  });
});

startServer();

module.exports = server; // exported for testing purposes
