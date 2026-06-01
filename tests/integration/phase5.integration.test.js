'use strict';

const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const TestClient = require('../helpers/testClient');
const {
  PASSWORD,
  createUser,
  shipmentPayload,
  uniqueEmail,
  userPayload,
  waitFor,
} = require('../helpers/factories');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('../setup/testDb');
const {
  connectTestRedis,
  startTestWorkers,
  stopTestRedis,
} = require('../setup/testRedis');
const { startTestServer, stopTestServer } = require('../setup/testServer');
const User = require('../../src/models/User');
const Shipment = require('../../src/models/Shipment');
const Payment = require('../../src/models/Payment');
const AuditLog = require('../../src/models/AuditLog');

let baseUrl;

const registerClient = async (role = 'shipper', overrides = {}) => {
  const client = new TestClient(baseUrl);
  await client.csrf();
  const payload = userPayload(role, overrides);
  const res = await client.post('/api/auth/register', payload);
  expect(res.status).toBe(201);
  return { client, user: res.body.data.user, payload };
};

const loginClient = async (email, password = PASSWORD) => {
  const client = new TestClient(baseUrl);
  await client.csrf();
  const res = await client.post('/api/auth/login', { email, password });
  expect(res.status).toBe(200);
  return { client, user: res.body.data.user };
};

const createAdminClient = async () => {
  const email = uniqueEmail('admin');
  const admin = await createUser('admin', { email, name: 'Admin User' });
  const { client, user } = await loginClient(email);
  return { client, user, admin };
};

const createShipmentFor = async (client, overrides = {}) => {
  const res = await client.post('/api/shipments', shipmentPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data.shipment;
};

const connectSocket = (client) =>
  new Promise((resolve) => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 2500,
      extraHeaders: client
        ? {
            Cookie: client.cookieHeader(),
            Origin: process.env.CLIENT_URL,
          }
        : { Origin: process.env.CLIENT_URL },
    });

    socket.once('connect', () => resolve({ socket }));
    socket.once('connect_error', (error) => {
      socket.disconnect();
      resolve({ error });
    });
  });

const joinRoom = (socket, shipmentId) =>
  new Promise((resolve) => {
    socket.emit('joinShipmentRoom', { shipmentId }, (ack) => resolve(ack));
  });

beforeAll(async () => {
  await connectTestDb();
  await connectTestRedis();
  ({ baseUrl } = await startTestServer());
  await startTestWorkers();
});

beforeEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestServer();
  await stopTestRedis();
  await disconnectTestDb();
});

describe('authentication, CSRF, and RBAC', () => {
  test('registers, hydrates, refreshes, rotates refresh hash, and logs out with cookies', async () => {
    const { client, user } = await registerClient('shipper');

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);

    const before = await User.findById(user._id).select('+refreshToken');
    const refresh = await client.post('/api/auth/refresh', {});
    expect(refresh.status).toBe(200);

    const after = await User.findById(user._id).select('+refreshToken');
    expect(after.refreshToken).toHaveLength(64);
    expect(after.refreshToken).not.toBe(before.refreshToken);

    const logout = await client.post('/api/auth/logout', {});
    expect(logout.status).toBe(200);

    const loggedOut = await client.get('/api/auth/me');
    expect(loggedOut.status).toBe(401);

    const audit = await waitFor(() => AuditLog.findOne({ action: 'auth.logout' }).lean());
    expect(audit).toBeTruthy();
  });

  test('rejects unsafe requests without CSRF and succeeds with valid CSRF', async () => {
    const client = new TestClient(baseUrl);
    const missing = await client.post('/api/auth/register', userPayload('shipper'), { csrf: false });

    expect(missing.status).toBe(403);
    expect(missing.body.message).toMatch(/CSRF/);
    expect(missing.body.requestId).toBeTruthy();

    await client.csrf();
    const valid = await client.post('/api/auth/register', userPayload('shipper'));
    expect(valid.status).toBe(201);
  });

  test('rejects inactive users and records refresh failures safely', async () => {
    const inactive = await createUser('shipper', { email: uniqueEmail('inactive'), isActive: false });
    const loginAttempt = new TestClient(baseUrl);
    await loginAttempt.csrf();

    const login = await loginAttempt.post('/api/auth/login', {
      email: inactive.email,
      password: PASSWORD,
    });
    expect(login.status).toBe(403);

    const refreshAttempt = await loginAttempt.post('/api/auth/refresh', {});
    expect(refreshAttempt.status).toBe(401);

    const audit = await waitFor(() => AuditLog.findOne({ action: 'auth.refresh_failed' }).lean());
    expect(audit).toBeTruthy();
    expect(audit.status).toBe('failure');
  });

  test('enforces shipper, driver, and admin route restrictions', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { client: driver } = await registerClient('driver');
    const { client: admin } = await createAdminClient();

    const shipperAdmin = await shipper.get('/api/admin/users');
    expect(shipperAdmin.status).toBe(403);

    const driverCreate = await driver.post('/api/shipments', shipmentPayload());
    expect(driverCreate.status).toBe(403);

    const adminDriver = await admin.get('/api/driver/shipments');
    expect(adminDriver.status).toBe(403);
  });
});

describe('shipments, admin controls, and driver workflow', () => {
  test('creates, lists, views, cancels shipments, and handles invalid ObjectIds', async () => {
    const { client: shipper } = await registerClient('shipper');
    const shipment = await createShipmentFor(shipper);

    expect(shipment.trackingNumber).toMatch(/^FF-\d{8}-[A-F0-9]{8}$/);

    const list = await shipper.get('/api/shipments/my');
    expect(list.status).toBe(200);
    expect(list.body.data.count).toBe(1);

    const detail = await shipper.get(`/api/shipments/${shipment._id}`);
    expect(detail.status).toBe(200);

    const invalid = await shipper.get('/api/shipments/not-an-id');
    expect(invalid.status).toBe(400);

    const cancel = await shipper.patch(`/api/shipments/${shipment._id}/cancel`, { note: 'cancel test' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.shipment.status).toBe('cancelled');

    const audit = await waitFor(() => AuditLog.findOne({ action: 'shipment.cancelled' }).lean());
    expect(audit).toBeTruthy();
  });

  test('assigns driver, enforces driver ownership, updates status, and protects admin self-status', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { client: driver, user: driverUser } = await registerClient('driver');
    const { client: otherDriver } = await registerClient('driver');
    const { client: admin, admin: adminDoc } = await createAdminClient();
    const shipment = await createShipmentFor(shipper);

    const unauthorized = await otherDriver.get(`/api/driver/shipments/${shipment._id}`);
    expect(unauthorized.status).toBe(403);

    const assign = await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, {
      driverId: driverUser._id,
      note: 'assign test',
    });
    expect(assign.status).toBe(200);
    expect(assign.body.data.shipment.status).toBe('assigned');

    const assigned = await driver.get('/api/driver/shipments');
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.count).toBe(1);

    const invalidTransition = await driver.patch(`/api/driver/shipments/${shipment._id}/status`, {
      status: 'delivered',
    });
    expect(invalidTransition.status).toBe(400);

    const statusUpdate = await driver.patch(`/api/driver/shipments/${shipment._id}/status`, {
      status: 'picked_up',
      note: 'picked up',
    });
    expect(statusUpdate.status).toBe(200);
    expect(statusUpdate.body.data.shipment.status).toBe('picked_up');

    const selfDeactivate = await admin.patch(`/api/admin/users/${adminDoc._id}/status`, {
      isActive: false,
    });
    expect(selfDeactivate.status).toBe(403);

    const deactivate = await admin.patch(`/api/admin/users/${driverUser._id}/status`, {
      isActive: false,
    });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.user.isActive).toBe(false);

    const blocked = await driver.get('/api/driver/shipments');
    expect(blocked.status).toBe(403);

    const reactivate = await admin.patch(`/api/admin/users/${driverUser._id}/status`, {
      isActive: true,
    });
    expect(reactivate.status).toBe(200);

    const audits = await waitFor(async () => {
      const count = await AuditLog.countDocuments({
        action: { $in: ['shipment.assigned', 'admin.user_deactivated', 'admin.user_activated'] },
      });
      return count >= 3 ? count : null;
    });
    expect(audits).toBe(3);
  });
});

describe('payments and database reliability', () => {
  test('initiates and confirms payment with transaction-backed status sync', async () => {
    const { client: shipper } = await registerClient('shipper');
    const shipment = await createShipmentFor(shipper);

    const initiated = await shipper.post(`/api/payments/initiate/${shipment._id}`, {
      amount: 2500,
      paymentMethod: 'card',
    });
    expect(initiated.status).toBe(201);
    expect(initiated.body.data.payment.status).toBe('pending');

    const pendingShipment = await Shipment.findById(shipment._id).lean();
    expect(pendingShipment.paymentStatus).toBe('pending');

    const confirmed = await shipper.post(`/api/payments/confirm/${initiated.body.data.payment._id}`, {
      simulate: 'success',
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.payment.status).toBe('paid');

    const paidShipment = await Shipment.findById(shipment._id).lean();
    expect(paidShipment.paymentStatus).toBe('paid');

    const audit = await waitFor(() => AuditLog.findOne({ action: 'payment.confirmed' }).lean());
    expect(audit).toBeTruthy();
  });

  test('rolls back payment creation when transaction update fails', async () => {
    const { client: shipper } = await registerClient('shipper');
    const shipment = await createShipmentFor(shipper);
    const original = Shipment.findByIdAndUpdate;

    jest.spyOn(Shipment, 'findByIdAndUpdate').mockImplementationOnce(() => {
      throw new Error('forced rollback');
    });

    const failed = await shipper.post(`/api/payments/initiate/${shipment._id}`, {
      amount: 2500,
      paymentMethod: 'upi',
    });
    expect(failed.status).toBe(500);

    Shipment.findByIdAndUpdate = original;

    expect(await Payment.countDocuments({ shipment: shipment._id })).toBe(0);
    const unchanged = await Shipment.findById(shipment._id).lean();
    expect(unchanged.paymentStatus).toBe('unpaid');
  });
});

describe('socket authorization and shipment events', () => {
  test('rejects anonymous sockets, authorizes rooms, and emits shipment events', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { client: otherShipper } = await registerClient('shipper');
    const { client: driver, user: driverUser } = await registerClient('driver');
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(shipper);

    const anonymous = await connectSocket(null);
    expect(anonymous.error.message).toMatch(/Authentication error/);

    const ownerConnection = await connectSocket(shipper);
    const otherConnection = await connectSocket(otherShipper);
    const driverConnection = await connectSocket(driver);

    expect(ownerConnection.socket.connected).toBe(true);
    expect(otherConnection.socket.connected).toBe(true);
    expect(driverConnection.socket.connected).toBe(true);

    const ownerAck = await joinRoom(ownerConnection.socket, shipment._id);
    expect(ownerAck.success).toBe(true);

    const otherAck = await joinRoom(otherConnection.socket, shipment._id);
    expect(otherAck.success).toBe(false);

    const driverBeforeAck = await joinRoom(driverConnection.socket, shipment._id);
    expect(driverBeforeAck.success).toBe(false);

    const assignmentEvent = new Promise((resolve) => {
      ownerConnection.socket.once('driverAssigned', resolve);
    });

    const assign = await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, {
      driverId: driverUser._id,
    });
    expect(assign.status).toBe(200);

    const assignedPayload = await assignmentEvent;
    expect(assignedPayload.shipmentId).toBe(shipment._id);

    const driverAfterAck = await joinRoom(driverConnection.socket, shipment._id);
    expect(driverAfterAck.success).toBe(true);

    const statusEvent = new Promise((resolve) => {
      ownerConnection.socket.once('statusUpdated', resolve);
    });

    const update = await driver.patch(`/api/driver/shipments/${shipment._id}/status`, {
      status: 'picked_up',
    });
    expect(update.status).toBe(200);

    const statusPayload = await statusEvent;
    expect(statusPayload.shipmentId).toBe(shipment._id);
    expect(statusPayload.newStatus).toBe('picked_up');

    ownerConnection.socket.disconnect();
    otherConnection.socket.disconnect();
    driverConnection.socket.disconnect();
  });
});

describe('health, readiness, and request correlation', () => {
  test('reports liveness, readiness, health summary, and request IDs', async () => {
    const client = new TestClient(baseUrl);
    const requestId = 'phase5-test-request-id';

    const live = await client.get('/api/live', { requestId });
    expect(live.status).toBe(200);
    expect(live.headers['x-request-id']).toBe(requestId);

    const ready = await client.get('/api/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.dependencies.mongo.ready).toBe(true);
    expect(ready.body.data.dependencies.redis.ready).toBe(true);

    const health = await client.get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.data.live).toBe(true);
    expect(health.body.data.ready).toBe(true);
    expect(health.body.data.version).toBeTruthy();
  });

  test('normalizes invalid ids with correlated error responses', async () => {
    const { client: shipper } = await registerClient('shipper');
    const res = await shipper.get('/api/shipments/not-an-id', {
      requestId: 'bad-id-request',
    });

    expect(res.status).toBe(400);
    expect(res.body.requestId).toBe('bad-id-request');
  });
});

test('validates environment configuration failures', () => {
  jest.isolateModules(() => {
    const original = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '5001';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/freightflow';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
      process.env.CLIENT_URL = '*';
      process.env.COOKIE_SECURE = 'false';

      const { validateEnv } = require('../../src/config/env');
      expect(() => validateEnv()).toThrow(/COOKIE_SECURE/);
    } finally {
      Object.keys(process.env).forEach((key) => delete process.env[key]);
      Object.assign(process.env, original);
    }
  });
});
