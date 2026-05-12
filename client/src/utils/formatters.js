/**
 * formatters.js
 * Pure helper functions for displaying data in a human-readable format.
 * No API calls. No side effects. Safe to import anywhere.
 */

/**
 * Formats an ISO date string into a readable date.
 * @param {string} dateString — ISO date string e.g. "2025-05-12T00:00:00.000Z"
 * @returns {string} — e.g. "12 May 2025"
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day:   '2-digit',
      month: 'long',
      year:  'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Formats a numeric amount as a currency string.
 * @param {number} amount
 * @param {string} currency — ISO 4217 currency code, default 'USD'
 * @returns {string} — e.g. "$1,250.00"
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style:                 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount}`;
  }
}

/**
 * Converts a backend snake_case status string into a display-friendly label.
 * @param {string} status — e.g. "in_transit"
 * @returns {string} — e.g. "In Transit"
 */
export function formatStatus(status) {
  const map = {
    pending:    'Pending',
    assigned:   'Assigned',
    picked_up:  'Picked Up',
    in_transit: 'In Transit',
    delivered:  'Delivered',
    cancelled:  'Cancelled',
  };
  return map[status] ?? status ?? '—';
}

/**
 * Returns the Badge variant string corresponding to a shipment status.
 * Maps to the variant prop accepted by <Badge />.
 * @param {string} status
 * @returns {'warning'|'info'|'success'|'danger'|'default'}
 */
export function getStatusVariant(status) {
  const map = {
    pending:    'warning',
    assigned:   'info',
    picked_up:  'info',
    in_transit: 'info',
    delivered:  'success',
    cancelled:  'danger',
  };
  return map[status] ?? 'default';
}

/**
 * Extracts up to two initials from a full name string.
 * @param {string} name — e.g. "John Doe"
 * @returns {string} — e.g. "JD"
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
