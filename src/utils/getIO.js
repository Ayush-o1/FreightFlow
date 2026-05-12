'use strict';

/**
 * IO Singleton — avoids circular imports between socketService and controllers.
 *
 * Usage:
 *   // In socketService.js after creating io:
 *   const { setIO } = require('../utils/getIO');
 *   setIO(io);
 *
 *   // In any controller that needs to emit:
 *   const { getIO } = require('../utils/getIO');
 *   const io = getIO();
 *   if (io) io.to(room).emit(event, payload);
 */

let _io = null;

/**
 * Store the Socket.io server instance.
 * Called once during server boot from socketService.js.
 * @param {import('socket.io').Server} ioInstance
 */
const setIO = (ioInstance) => {
  _io = ioInstance;
};

/**
 * Retrieve the Socket.io server instance.
 * Returns null if Socket.io has not been initialized yet.
 * @returns {import('socket.io').Server | null}
 */
const getIO = () => _io;

module.exports = { setIO, getIO };
