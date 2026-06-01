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
 *
 *  AUTHENTICATION
 *  ──────────────
 *  Every WebSocket upgrade is authenticated via the ff_access_token
 *  httpOnly cookie. Connections without a valid token are rejected
 *  before the 'connection' event fires.
 *  Socket.data.user is set to the active user's id, role, and name on success.
 * ══════════════════════════════════════════════════════════════
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt        = require('jsonwebtoken');
const mongoose   = require('mongoose');
const User       = require('../models/User');
const Shipment   = require('../models/Shipment');
const { setIO }  = require('../utils/getIO');
const { COOKIE_NAMES, buildAllowedOrigins } = require('../config/security');
const logger = require('../config/logger');
const { createRedisDuplicate } = require('../config/redis');

// ── Dev-only logger ───────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
const devLog = (message, data = {}) => {
  if (isDev) logger.debug(data, message);
};

// ── Cookie parser helper ──────────────────────────────────────────────────────
/**
 * Parses a raw Cookie header string into a key→value map.
 * Used because socket.handshake doesn't go through cookie-parser middleware.
 * @param {string} cookieHeader — e.g. "ff_access_token=abc; other=xyz"
 * @returns {Record<string, string>}
 */
const parseCookies = (cookieHeader = '') => {
  const cookies = {};
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key   = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    // Decode URI-encoded values (browsers encode cookie values)
    try { cookies[key] = decodeURIComponent(value); }
    catch { cookies[key] = value; }
  });
  return cookies;
};

const canJoinShipmentRoom = (user, shipment) => {
  if (!user || !shipment) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'shipper') {
    return shipment.shipper?.toString() === user.id;
  }

  if (user.role === 'driver') {
    return shipment.driver?.toString() === user.id;
  }

  return false;
};

const emitRoomError = (socket, ack, shipmentId, message) => {
  const payload = { success: false, shipmentId, message };
  if (typeof ack === 'function') ack(payload);
  socket.emit('shipmentRoomError', payload);
};

/**
 * Initializes Socket.io and attaches it to the HTTP server.
 * Must be called once during server boot, after HTTP server creation.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance
 */
const attachRedisAdapter = async (io) => {
  const pubClient = await createRedisDuplicate();
  const subClient = await createRedisDuplicate();

  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.io Redis adapter attached');
};

const initSocket = async (httpServer) => {
  const allowedOrigins = buildAllowedOrigins();

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Socket CORS: origin ${origin} not allowed`));
      },
      credentials: true,   // Required: browser must send the httpOnly cookie on WS upgrade
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  await attachRedisAdapter(io);

  // ── Store io in singleton so controllers can emit without circular imports ──
  setIO(io);

  // ── Socket Authentication Middleware ─────────────────────────────────────────
  // Runs BEFORE the 'connection' event. Unauthenticated clients are rejected here.
  //
  // Strategy:
  //   1. Parse the Cookie header from the WS upgrade handshake
  //   2. Extract ff_access_token (set by login/register/refresh endpoints)
  //   3. Verify the JWT — reject with an error if invalid or missing
  //   4. Attach the decoded userId to socket.data for downstream handlers
  //
  // Note: cookie-parser does NOT run on socket handshakes. We parse manually.
  io.use(async (socket, next) => {
    try {
      const rawCookies = socket.handshake.headers?.cookie || '';
      const cookies    = parseCookies(rawCookies);
      const token      = cookies[COOKIE_NAMES.access];

      if (!token) {
        return next(new Error('Authentication error: No access token provided.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id).select('_id name role isActive');

      if (!currentUser || !currentUser.isActive) {
        return next(new Error('Authentication error: User is inactive or no longer exists.'));
      }

      socket.data.user = {
        id: currentUser._id.toString(),
        name: currentUser.name,
        role: currentUser.role,
      };
      devLog('Socket auth OK', { userId: socket.data.user.id });

      next();
    } catch (err) {
      // Covers: JsonWebTokenError, TokenExpiredError, malformed cookies
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // ── Connection lifecycle ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    devLog('Socket connected', { socketId: socket.id, userId: socket.data.user.id });

    // ── Client → Server: join a shipment room ────────────────────────────────
    socket.on('joinShipmentRoom', async ({ shipmentId } = {}, ack) => {
      try {
        if (!shipmentId || !mongoose.Types.ObjectId.isValid(shipmentId)) {
          return emitRoomError(socket, ack, shipmentId, 'Invalid shipment room.');
        }

        const shipment = await Shipment.findById(shipmentId)
          .select('shipper driver')
          .lean();

        if (!shipment) {
          return emitRoomError(socket, ack, shipmentId, 'Shipment not found.');
        }

        if (!canJoinShipmentRoom(socket.data.user, shipment)) {
          return emitRoomError(
            socket,
            ack,
            shipmentId,
            'Access denied. You cannot subscribe to this shipment.'
          );
        }

        const room = `shipment_${shipmentId}`;
        socket.join(room);
        if (typeof ack === 'function') ack({ success: true, shipmentId });
        devLog('Socket joined shipment room', { socketId: socket.id, room });
      } catch (error) {
        emitRoomError(socket, ack, shipmentId, 'Unable to join shipment room.');
        devLog('Socket room join failed', { err: error, shipmentId });
      }
    });

    // ── Client → Server: leave a shipment room ───────────────────────────────
    socket.on('leaveShipmentRoom', ({ shipmentId } = {}) => {
      if (!shipmentId) return;
      const room = `shipment_${shipmentId}`;
      socket.leave(room);
      devLog('Socket left shipment room', { socketId: socket.id, room });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      devLog('Socket disconnected', { socketId: socket.id, reason });
    });
  });

  logger.info('Socket.io initialized successfully.');
  return io;
};

module.exports = { initSocket };
