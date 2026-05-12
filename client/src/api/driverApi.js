/**
 * driverApi.js
 * All driver-specific API calls for the FreightFlow frontend.
 *
 * Route prefix confirmed from app.js: /api/driver
 * All endpoints require: role === 'driver' + valid JWT (protect + authorizeRoles middleware)
 *
 * Endpoints (from driverRoutes.js):
 *   GET    /api/driver/shipments          → getAssignedShipments controller
 *   GET    /api/driver/shipments/:id      → getShipmentDetail controller
 *   PATCH  /api/driver/shipments/:id/status → updateShipmentStatus controller
 */

import axiosInstance from './axiosInstance';

// ── GET MY ASSIGNMENTS ────────────────────────────────────────────────────────
/**
 * Fetch all shipments assigned to the authenticated driver.
 * Supports ?status= query param for filtering.
 *
 * @param {Object} [params]        — optional query params
 * @param {string} [params.status] — filter: 'assigned' | 'picked_up' | 'in_transit' | 'delivered'
 * @returns {Promise} response.data.data.{ count, shipments[] }
 */
export const getMyAssignments = (params = {}) =>
  axiosInstance.get('/api/driver/shipments', { params });

// ── GET SINGLE ASSIGNMENT ─────────────────────────────────────────────────────
/**
 * Fetch full detail of a single shipment assigned to this driver.
 * Returns 403 if shipment is not assigned to the calling driver.
 *
 * @param {string} id — MongoDB ObjectId string
 * @returns {Promise} response.data.data.shipment
 */
export const getAssignmentById = (id) =>
  axiosInstance.get(`/api/driver/shipments/${id}`);
