'use strict';

/**
 * ══════════════════════════════════════════════════════════
 *  FreightFlow — Mock Notification Service
 * ══════════════════════════════════════════════════════════
 *  No real email is sent. All notifications are console.log
 *  formatted messages that simulate outbound emails.
 *  Swap the console.log bodies with a real email transport
 *  (e.g. Nodemailer + SMTP) when going to production.
 * ══════════════════════════════════════════════════════════
 */

const logger = require('../config/logger');

const logMockEmail = (message) => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Mock notification suppressed in production.');
    return;
  }

  logger.debug({ notification: message }, 'Mock notification generated');
};

/**
 * Notify shipper that their shipment has been created.
 * @param {Object} shipment - Mongoose Shipment document
 * @param {Object} shipper  - User object (name, email)
 */
const notifyShipmentCreated = (shipment, shipper) => {
  logMockEmail(`
[EMAIL] To: ${shipper.email}
  Subject: Shipment Created — ${shipment._id}
  Body:    Your shipment has been created successfully.
           Pickup: ${shipment.pickupLocation.city} → ${shipment.deliveryLocation.city}
           Status: pending
  `);
};

/**
 * Notify shipper that a driver has been assigned,
 * and notify the driver about their new assignment.
 * @param {Object} shipment - Populated Mongoose Shipment document
 * @param {Object} shipper  - User object (name, email)
 * @param {Object} driver   - User object (name, email)
 */
const notifyDriverAssigned = (shipment, shipper, driver) => {
  // Notify the shipper
  logMockEmail(`
[EMAIL] To: ${shipper.email}
  Subject: Driver Assigned — ${shipment._id}
  Body:    Driver ${driver.name} has been assigned to your shipment.
  `);

  // Notify the driver
  logMockEmail(`
[EMAIL] To: ${driver.email}
  Subject: New Assignment — ${shipment._id}
  Body:    You have been assigned shipment ${shipment._id}.
           Pickup from: ${shipment.pickupLocation.city}
  `);
};

/**
 * Notify shipper that their shipment status has changed.
 * @param {Object} shipment   - Populated Mongoose Shipment document
 * @param {Object} shipper    - User object (name, email)
 * @param {string} newStatus  - The new delivery status
 */
const notifyStatusUpdated = (shipment, shipper, newStatus) => {
  logMockEmail(`
[EMAIL] To: ${shipper.email}
  Subject: Shipment Update — ${shipment._id}
  Body:    Your shipment status is now: ${newStatus}
  `);
};

/**
 * Notify shipper that their shipment has been delivered.
 * @param {Object} shipment - Populated Mongoose Shipment document
 * @param {Object} shipper  - User object (name, email)
 */
const notifyDelivered = (shipment, shipper) => {
  logMockEmail(`
[EMAIL] To: ${shipper.email}
  Subject: Delivered — ${shipment._id}
  Body:    Your shipment has been delivered. Thank you!
  `);
};

module.exports = {
  notifyShipmentCreated,
  notifyDriverAssigned,
  notifyStatusUpdated,
  notifyDelivered,
};
