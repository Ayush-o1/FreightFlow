/**
 * adminApi.js
 * All admin-specific API calls for the FreightFlow frontend.
 *
 * Route prefix confirmed from app.js: /api/admin
 * All endpoints require: role === 'admin' + valid JWT (protect + authorizeRoles middleware)
 *
 * Confirmed endpoints (from adminRoutes.js + adminController.js):
 *
 *   GET    /api/admin/analytics              → getAnalytics
 *   GET    /api/admin/shipments              → getAllShipments  (?status ?search ?page ?limit)
 *   GET    /api/admin/shipments/:id          → getShipmentById
 *   PATCH  /api/admin/shipments/:id/assign   → assignDriver     body: { driverId }
 *   GET    /api/admin/users                  → getAllUsers       (?role)
 *   GET    /api/admin/drivers                → getAllDrivers     (active drivers only, lightweight)
 *
 * NOT FOUND on backend (skipped — do not call):
 *   ✗ DELETE /api/admin/users/:id   — no delete user endpoint exists
 *   ✗ PATCH  /api/admin/users/:id   — no role-change / update-user endpoint exists
 *   ✗ GET    /api/admin/users/:id   — no single user detail endpoint exists
 */

import axiosInstance from './axiosInstance';

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
/**
 * Fetch platform-wide analytics in a single dedicated endpoint.
 * Returns: { totalShipments, shipmentsByStatus{}, totalShippers, totalDrivers,
 *             totalRevenue, recentShipments[] }
 *
 * @returns {Promise} response.data.data — analytics object
 */
export const getAnalytics = () =>
  axiosInstance.get('/api/admin/analytics');

// ── SHIPMENTS ─────────────────────────────────────────────────────────────────
/**
 * Fetch all shipments platform-wide. Supports filtering, search, pagination.
 * Shipper and Driver are populated: { name, email } objects (not raw IDs).
 *
 * @param {Object} [params]
 * @param {string} [params.status]  — filter: 'pending'|'assigned'|'picked_up'|'in_transit'|'delivered'|'cancelled'
 * @param {string} [params.search]  — keyword (matches shipper name, driver name, goodsType)
 * @param {number} [params.page]    — default 1
 * @param {number} [params.limit]   — default 10, max 100
 * @returns {Promise} response.data.data — { total, page, totalPages, count, shipments[] }
 */
export const getAllShipments = (params = {}) =>
  axiosInstance.get('/api/admin/shipments', { params });

/**
 * Get a single shipment by ID (admin view — full statusHistory populated).
 * @param {string} id — MongoDB ObjectId
 * @returns {Promise} response.data.data.shipment
 */
export const getAdminShipmentById = (id) =>
  axiosInstance.get(`/api/admin/shipments/${id}`);

/**
 * Assign a driver to a pending shipment.
 * Backend enforces: shipment must be status 'pending', driver must be active role=driver.
 * After assignment shipment status changes to 'assigned'.
 *
 * @param {string} shipmentId — MongoDB ObjectId of the shipment
 * @param {string} driverId   — MongoDB ObjectId of the driver user
 * @returns {Promise} response.data.data.shipment — updated shipment with driver populated
 */
export const assignDriver = (shipmentId, driverId) =>
  axiosInstance.patch(`/api/admin/shipments/${shipmentId}/assign`, { driverId });

/**
 * Cancel any non-cancelled shipment as admin.
 * PATCH /api/admin/shipments/:id/cancel
 *
 * @param {string} shipmentId — MongoDB ObjectId of the shipment
 * @param {string} [note]    — optional cancellation note
 * @returns {Promise} response.data.data.shipment — updated shipment
 */
export const cancelShipmentAsAdmin = (shipmentId, note) =>
  axiosInstance.patch(
    `/api/admin/shipments/${shipmentId}/cancel`,
    note ? { note } : {}
  );

// ── USERS ─────────────────────────────────────────────────────────────────────
/**
 * Fetch all users. Supports role filter.
 * Returns safe fields: _id, name, email, role, isActive, createdAt, updatedAt.
 * Password is excluded at model level (select: false).
 *
 * @param {Object} [params]
 * @param {string} [params.role] — 'shipper' | 'driver' | 'admin'
 * @returns {Promise} response.data.data — { count, users[] }
 */
export const getAllUsers = (params = {}) =>
  axiosInstance.get('/api/admin/users', { params });

/**
 * Fetch all active drivers — lightweight endpoint for dropdowns.
 * Returns only: _id, name, email (sorted by name ASC).
 *
 * @returns {Promise} response.data.data — { count, drivers[] }
 */
export const getAllDrivers = () =>
  axiosInstance.get('/api/admin/drivers');

// ── USER STATUS MANAGEMENT ────────────────────────────────────────────────────
/**
 * Activate or deactivate a user account.
 * PATCH /api/admin/users/:id/status
 *
 * Body: { isActive: boolean }
 *   isActive: true  → activate the account
 *   isActive: false → deactivate the account (also invalidates their session)
 *
 * Rules enforced server-side:
 *   - Admin cannot deactivate their own account (returns 403)
 *   - No-op if the account is already in the requested state (returns 400)
 *
 * @param {string}  userId   — MongoDB ObjectId of the target user
 * @param {boolean} isActive — true to activate, false to deactivate
 * @returns {Promise} response.data.data.user — updated user object
 */
export const updateUserStatus = (userId, isActive) =>
  axiosInstance.patch(`/api/admin/users/${userId}/status`, { isActive });

// ── SKIPPED ENDPOINTS (not in backend) ───────────────────────────────────────
// ✗ getUserById(id)      — GET /api/admin/users/:id does not exist
// ✗ deleteUser(id)       — DELETE /api/admin/users/:id does not exist
// ✗ updateUserRole(id)   — PATCH /api/admin/users/:id does not exist
