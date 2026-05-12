/**
 * paymentApi.js
 * All payment-related API calls for the FreightFlow frontend.
 *
 * Route prefix: /api/payments  (mounted in app.js)
 * All routes require JWT (attached by axiosInstance interceptor).
 *
 * Payment flow (2-step simulation):
 *   1. initiatePayment  → creates a pending Payment record
 *   2. confirmPayment   → simulates success or failure, marks Shipment.paymentStatus
 *
 * Note: getMyPayments() does NOT exist on the backend — no such route in paymentRoutes.js.
 */

import axiosInstance from './axiosInstance';

// ── INITIATE PAYMENT ──────────────────────────────────────────────────────────
/**
 * Create a pending payment record for a shipment.
 * POST /api/payments/initiate/:shipmentId
 *
 * @param {string} shipmentId  — MongoDB ObjectId of the shipment
 * @param {Object} data
 * @param {number} data.amount         — positive number (required)
 * @param {string} data.paymentMethod  — 'card' | 'upi' | 'netbanking' (required)
 * @returns {Promise} response.data.data.payment — the created Payment document
 */
export const initiatePayment = (shipmentId, data) =>
  axiosInstance.post(`/api/payments/initiate/${shipmentId}`, data);

// ── CONFIRM PAYMENT ───────────────────────────────────────────────────────────
/**
 * Simulate payment success or failure.
 * POST /api/payments/confirm/:paymentId
 *
 * @param {string} paymentId  — MongoDB ObjectId of the Payment record
 * @param {'success'|'failure'} simulate — controls outcome
 * @returns {Promise} response.data.data.payment — the updated Payment document
 */
export const confirmPayment = (paymentId, simulate = 'success') =>
  axiosInstance.post(`/api/payments/confirm/${paymentId}`, { simulate });

// ── GET PAYMENT BY SHIPMENT ───────────────────────────────────────────────────
/**
 * Retrieve the payment record for a given shipment.
 * GET /api/payments/:shipmentId
 * Access: Shipper (own shipment only) | Admin (any)
 *
 * Returns 404 if no payment has been initiated yet for this shipment.
 * Callers should handle 404 gracefully (show "No payment record" UI, not an error).
 *
 * @param {string} shipmentId — MongoDB ObjectId of the shipment
 * @returns {Promise} response.data.data.payment
 */
export const getPaymentByShipment = (shipmentId) =>
  axiosInstance.get(`/api/payments/${shipmentId}`);

// ── GET MY PAYMENTS ───────────────────────────────────────────────────────────
/**
 * ⚠️  This endpoint does NOT exist in paymentRoutes.js.
 * The backend only exposes: POST /initiate/:id, POST /confirm/:id, GET /:shipmentId.
 * There is no "get all my payments" route. Function omitted intentionally.
 */
// export const getMyPayments = () => axiosInstance.get('/api/payments/my');
