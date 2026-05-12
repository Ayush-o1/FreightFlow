'use strict';

// ─── Character pool for random suffix ────────────────────────────────────────
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a mock transaction ID suitable for simulated payments.
 *
 * Format: TXN-{Date.now()}-{6 random uppercase alphanumeric characters}
 * Example: TXN-1719832940123-X7K2PQ
 *
 * @returns {string}
 */
const generateMockTransactionId = () => {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return `TXN-${Date.now()}-${suffix}`;
};

module.exports = { generateMockTransactionId };
