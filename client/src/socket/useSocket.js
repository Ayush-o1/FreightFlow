/**
 * useSocket.js
 * Custom hooks for socket.io lifecycle and event listening.
 *
 * useSocketConnection()
 *   ─ Connects the singleton socket when the user is authenticated.
 *   ─ Disconnects cleanly when the user logs out or the component unmounts.
 *   ─ Call this ONCE, inside DashboardLayout, so one connection covers the whole session.
 *   ─ No 'joinShipmentRoom' emit here — rooms are per-shipment, joined by individual pages.
 *   ─ Auth is handled via httpOnly cookies (sent automatically on WS upgrade) —
 *     no manual token attachment is needed.
 *
 * useSocketEvent(eventName, handler)
 *   ─ Registers a socket.on listener and cleans it up on unmount or dependency change.
 *   ─ Safe to call from any component — never leaks listeners.
 *
 * Confirmed server event names (from socketService.js + controllers):
 *   'joinShipmentRoom'   → client emits to join room  { shipmentId }
 *   'leaveShipmentRoom'  → client emits to leave room { shipmentId }
 *   'statusUpdated'      → server emits after driver status advance
 *   'shipmentDelivered'  → server emits in addition when status === 'delivered'
 *   'driverAssigned'     → server emits after admin assigns a driver
 */

import { useEffect } from 'react';
import { useAuth }   from '../hooks/useAuth';
import socket        from './socketClient';

// ── useSocketConnection ───────────────────────────────────────────────────────
/**
 * Manages the socket lifecycle for the authenticated session.
 * Connect when user + token are present; disconnect on cleanup.
 * Returns the socket instance for any direct use if needed.
 */
export function useSocketConnection() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Auth is via httpOnly cookie (withCredentials: true on socketClient).
    // No manual token attachment needed — the browser sends the cookie automatically
    // during the WebSocket upgrade handshake.
    socket.connect();

    // NOTE: backend does NOT use per-user rooms — only per-shipment rooms.
    // Rooms are joined by individual pages via 'joinShipmentRoom'.

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return socket;
}

// ── useSocketEvent ────────────────────────────────────────────────────────────
/**
 * Registers a socket event listener with guaranteed cleanup on unmount.
 *
 * @param {string}   eventName — exact event name from backend (e.g. 'statusUpdated')
 * @param {Function} handler   — callback receiving the event payload
 */
export function useSocketEvent(eventName, handler) {
  useEffect(() => {
    if (!eventName || typeof handler !== 'function') return;

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [eventName, handler]);
}

// ── helpers for joining / leaving shipment rooms ──────────────────────────────
/**
 * Join a per-shipment socket room.
 * Call after socket is connected and the shipment ID is known.
 * Exact event name: 'joinShipmentRoom', payload: { shipmentId }
 *
 * @param {string} shipmentId
 */
export function joinShipmentRoom(shipmentId) {
  if (shipmentId) socket.emit('joinShipmentRoom', { shipmentId });
}

/**
 * Leave a per-shipment socket room.
 * Exact event name: 'leaveShipmentRoom', payload: { shipmentId }
 *
 * @param {string} shipmentId
 */
export function leaveShipmentRoom(shipmentId) {
  if (shipmentId) socket.emit('leaveShipmentRoom', { shipmentId });
}
