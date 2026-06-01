/**
 * shipmentApi.js
 * All shipment-related API calls for the FreightFlow frontend.
 *
 * Uses axiosInstance — JWT is attached automatically by the request interceptor.
 * Every function returns the Axios promise; callers handle .then/.catch.
 *
 * Route prefix: /api/shipments  (mounted in app.js)
 */

import axiosInstance from './axiosInstance';

// ── CREATE ────────────────────────────────────────────────────────────────────
/**
 * Create a new shipment request.
 * @param {Object} data
 * @param {Object} data.pickupLocation   — { address, city, state, pincode }
 * @param {Object} data.deliveryLocation — { address, city, state, pincode }
 * @param {string} data.goodsType        — e.g. "Electronics"
 * @param {number} data.weight           — positive float, kg
 * @param {string} [data.description]    — optional notes
 * @param {string} [data.estimatedDelivery] — optional ISO 8601 date string
 * @returns {Promise} response.data.data.shipment on success
 */
export const createShipment = (data) =>
  axiosInstance.post('/api/shipments', data);

// ── GET MY SHIPMENTS ──────────────────────────────────────────────────────────
/**
 * Fetch all shipments belonging to the authenticated shipper.
 * Backend filters by JWT user automatically — no extra param needed.
 * @param {Object} [params]        — optional query params
 * @param {string} [params.status] — filter by status enum value
 * @returns {Promise} response.data.data.{ count, shipments[] } on success
 */
export const getMyShipments = (params = {}) =>
  axiosInstance.get('/api/shipments/my', { params });

// ── GET BY ID ─────────────────────────────────────────────────────────────────
/**
 * Fetch a single shipment by MongoDB ObjectId.
 * Shipper can only view their own shipments (enforced server-side).
 * @param {string} id — MongoDB ObjectId string
 * @returns {Promise} response.data.data.shipment on success
 */
export const getShipmentById = (id) =>
  axiosInstance.get(`/api/shipments/${id}`);

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
/**
 * Fetch all shipments and derive dashboard stats client-side.
 * No dedicated stats endpoint exists on the backend — we call getMyShipments()
 * and count by status. Returns a plain object, not a promise.
 *
 * NOTE: This function is NOT async — callers use getMyShipments() directly
 * and pass the shipments array to computeDashboardStats() below.
 */

/**
 * Compute stat counts from a shipments array.
 * @param {Array} shipments
 * @returns {{ total, pending, inTransit, delivered, cancelled }}
 */
export const computeDashboardStats = (shipments = []) => ({
  total:     shipments.length,
  pending:   shipments.filter((s) => s.status === 'pending').length,
  // Both picked_up and in_transit count as "In Transit" for the dashboard
  inTransit: shipments.filter((s) => s.status === 'in_transit' || s.status === 'picked_up').length,
  delivered: shipments.filter((s) => s.status === 'delivered').length,
  cancelled: shipments.filter((s) => s.status === 'cancelled').length,
});

// ── CANCEL SHIPMENT ───────────────────────────────────────────────────────────
/**
 * Cancel a pending shipment.
 * PATCH /api/shipments/:id/cancel
 *
 * Business rules (enforced server-side):
 *   - Only the owning shipper can cancel
 *   - Only 'pending' shipments can be cancelled
 *
 * @param {string} id    — MongoDB ObjectId of the shipment
 * @param {string} [note] — optional cancellation note (max 500 chars)
 * @returns {Promise} response.data.data.shipment — updated shipment
 */
export const cancelShipment = (id, note) =>
  axiosInstance.patch(`/api/shipments/${id}/cancel`, note ? { note } : {});

// ── UPDATE SHIPMENT STATUS (driver) ──────────────────────────────────────────
/**
 * Advance a shipment's delivery status. Driver-only endpoint.
 * Backend enforces strict forward-only progression:
 *   assigned → picked_up → in_transit → delivered
 *
 * Endpoint: PATCH /api/driver/shipments/:id/status
 *
 * @param {string} id         — MongoDB ObjectId of the shipment
 * @param {Object} data
 * @param {string} data.status — next status (must match allowed transition)
 * @param {string} [data.note] — optional note stored in statusHistory.note
 *                               (backend defaults to "Status updated to X by driver." if omitted)
 * @returns {Promise} response.data.data.shipment — fully populated updated shipment
 */
export const updateShipmentStatus = (id, data) =>
  axiosInstance.patch(`/api/driver/shipments/${id}/status`, data);
