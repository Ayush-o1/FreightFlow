/**
 * socketClient.js
 * Singleton socket.io-client instance for FreightFlow.
 *
 * ─── Server socket event reference (from socketService.js) ───────────────────
 *
 * CLIENT → SERVER (events the backend listens for):
 *   joinShipmentRoom   { shipmentId }  — join a per-shipment room
 *   leaveShipmentRoom  { shipmentId }  — leave a per-shipment room
 *
 * SERVER → CLIENT (events the backend emits):
 *   statusUpdated      { shipmentId, newStatus, updatedBy, role, note, timestamp }
 *     emitted by driverController after status advance
 *     room: `shipment_${shipmentId}`
 *
 *   shipmentDelivered  { shipmentId, message, timestamp }
 *     emitted in addition to statusUpdated when newStatus === 'delivered'
 *     room: `shipment_${shipmentId}`
 *
 *   driverAssigned     { shipmentId, driverId, driverName, status, message, timestamp }
 *     emitted by adminController after driver assignment
 *     room: `shipment_${shipmentId}`
 *
 * ROOM STRATEGY: per-shipment rooms named `shipment_${shipmentId}`.
 *   No per-user rooms. No global broadcasts.
 *   Clients must emit 'joinShipmentRoom' to receive events for a shipment.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Import this singleton everywhere — never create a second instance.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect:     false,   // connect only after user is authenticated
  withCredentials: true,
  transports:      ['websocket', 'polling'],
});

export default socket;
