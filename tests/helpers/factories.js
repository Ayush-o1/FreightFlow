'use strict';

const User = require('../../src/models/User');

const PASSWORD = 'StrongPass123!';

const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@test.local`;

const userPayload = (role = 'shipper', overrides = {}) => ({
  name: `${role} User`,
  email: uniqueEmail(role),
  password: PASSWORD,
  role,
  ...overrides,
});

const createUser = async (role = 'shipper', overrides = {}) =>
  User.create(userPayload(role, overrides));

const shipmentPayload = (overrides = {}) => ({
  pickupLocation: {
    address: 'Pickup address',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
  },
  deliveryLocation: {
    address: 'Delivery address',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  goodsType: 'Electronics',
  weight: 25,
  description: 'Test shipment',
  ...overrides,
});

const waitFor = async (predicate, { timeout = 2000, interval = 25 } = {}) => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return null;
};

module.exports = {
  PASSWORD,
  createUser,
  shipmentPayload,
  uniqueEmail,
  userPayload,
  waitFor,
};
