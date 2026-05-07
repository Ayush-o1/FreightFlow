'use strict';

/**
 * ══════════════════════════════════════════════════════════════
 *  FreightFlow — Socket.io Real-Time Event Reference
 * ══════════════════════════════════════════════════════════════
 *
 *  CLIENT → SERVER events
 *  ─────────────────────
 *  joinShipmentRoom    { shipmentId }
 *    Client joins a private room for a specific shipment so it
 *    receives all future status events for that shipment.
 *
 *  leaveShipmentRoom   { shipmentId }
 *    Client leaves the shipment room (e.g. on component unmount).
 *
 *  SERVER → CLIENT events
 *  ──────────────────────
 *  driverAssigned      { shipmentId, driverId, driverName,
 *                        status, message, timestamp }
 *    Emitted after admin assigns a driver to a shipment.
 *    Sent only to room: `shipment_${shipmentId}`.
 *
 *  statusUpdated       { shipmentId, newStatus, updatedBy,
 *                        role, note, timestamp }
 *    Emitted after a driver updates shipment status.
 *    Sent only to room: `shipment_${shipmentId}`.
 *
 *  shipmentDelivered   { shipmentId, message, timestamp }
 *    Emitted in addition to statusUpdated when newStatus
 *    is 'delivered'. Sent only to room: `shipment_${shipmentId}`.
 * ══════════════════════════════════════════════════════════════
 */

const { Server } = require('socket.io');
const { setIO }  = require('../utils/getIO');

/**
 * Initializes Socket.io and attaches it to the HTTP server.
 * Must be called once during server boot, after HTTP server creation.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin:  process.env.CLIENT_URL,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  // ── Store io in singleton so controllers can emit without circular imports ──
  setIO(io);

  // ── Connection lifecycle ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌  Socket connected    → id: ${socket.id}`);

    // ── Client → Server: join a shipment room ────────────────────────────────
    socket.on('joinShipmentRoom', ({ shipmentId } = {}) => {
      if (!shipmentId) return;
      const room = `shipment_${shipmentId}`;
      socket.join(room);
      console.log(`📦  Socket ${socket.id} joined  room: ${room}`);
    });

    // ── Client → Server: leave a shipment room ───────────────────────────────
    socket.on('leaveShipmentRoom', ({ shipmentId } = {}) => {
      if (!shipmentId) return;
      const room = `shipment_${shipmentId}`;
      socket.leave(room);
      console.log(`📦  Socket ${socket.id} left    room: ${room}`);
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌  Socket disconnected → id: ${socket.id} (reason: ${reason})`);
    });
  });

  console.log('⚡  Socket.io initialized successfully.');
  return io;
};

module.exports = { initSocket };
