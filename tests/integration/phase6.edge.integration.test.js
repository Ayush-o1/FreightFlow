'use strict';

const mongoose = require('mongoose');
const TestClient = require('../helpers/testClient');
const {
  PASSWORD,
  createUser,
  shipmentPayload,
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
const OutboxEvent = require('../../src/models/OutboxEvent');

let baseUrl;

const registerClient = async (role = 'shipper', overrides = {}) => {
  const client = new TestClient(baseUrl);
  await client.csrf();
  const res = await client.post('/api/auth/register', userPayload(role, overrides));
  expect(res.status).toBe(201);
  return { client, user: res.body.data.user };
};

const loginClient = async (email, password = PASSWORD) => {
  const client = new TestClient(baseUrl);
  await client.csrf();
  const res = await client.post('/api/auth/login', { email, password });
  expect(res.status).toBe(200);
  return { client, user: res.body.data.user };
};

const createAdminClient = async () => {
  const admin = await createUser('admin', { name: 'Admin User' });
  const { client, user } = await loginClient(admin.email);
  return { client, user, admin };
};

const createShipmentFor = async (client, overrides = {}) => {
  const res = await client.post('/api/shipments', shipmentPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data.shipment;
};

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

describe('Phase 6 edge coverage', () => {
  test('covers admin list filters, search pagination, and lookup failures', async () => {
    const { client: shipper } = await registerClient('shipper', { name: 'Searchable Shipper' });
    const { client: admin } = await createAdminClient();
    await registerClient('driver', { name: 'Searchable Driver' });
    await createShipmentFor(shipper, { goodsType: 'Searchable Goods' });

    expect((await admin.get('/api/admin/shipments?status=bad')).status).toBe(400);

    const searched = await admin.get('/api/admin/shipments', {
      requestId: 'admin-search',
    });
    expect(searched.status).toBe(200);
    expect(searched.body.data.total).toBe(1);

    const searchParam = await admin.get('/api/admin/shipments?search=Searchable&page=1&limit=1');
    expect(searchParam.status).toBe(200);
    expect(searchParam.body.data.count).toBe(1);

    expect((await admin.get('/api/admin/users?role=bad')).status).toBe(400);
    expect((await admin.get('/api/admin/users?role=driver&page=1&limit=5')).status).toBe(200);
    expect((await admin.get('/api/admin/drivers?page=1&limit=5')).status).toBe(200);

    const missingShipment = await admin.get(`/api/admin/shipments/${new mongoose.Types.ObjectId()}`);
    expect(missingShipment.status).toBe(404);
  });

  test('covers admin assignment, cancellation, and user-status edge cases', async () => {
    const { client: shipper, user: shipperUser } = await registerClient('shipper');
    const { user: driverUser } = await registerClient('driver');
    const inactiveDriver = await createUser('driver', { isActive: false });
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(shipper);
    const missingId = new mongoose.Types.ObjectId();

    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, {})).status).toBe(422);
    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: 'bad' })).status).toBe(422);
    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: shipperUser._id })).status).toBe(400);
    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: inactiveDriver._id })).status).toBe(400);
    expect((await admin.patch(`/api/admin/shipments/${missingId}/assign`, { driverId: driverUser._id })).status).toBe(404);

    const cancelled = await admin.patch(`/api/admin/shipments/${shipment._id}/cancel`, { note: 'admin cancel' });
    expect(cancelled.status).toBe(200);
    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/cancel`, {})).status).toBe(400);
    expect((await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: driverUser._id })).status).toBe(409);

    expect((await admin.patch(`/api/admin/users/${missingId}/status`, { isActive: false })).status).toBe(404);
    expect((await admin.patch(`/api/admin/users/${shipperUser._id}/status`, { isActive: true })).status).toBe(400);
  });

  test('covers shipper authorization, filtering, cancellation, and idempotency validation', async () => {
    const { client: owner } = await registerClient('shipper');
    const { client: other } = await registerClient('shipper');
    const { user: driverUser } = await registerClient('driver');
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(owner);
    const missingId = new mongoose.Types.ObjectId();

    expect((await owner.get('/api/shipments/my?status=bad')).status).toBe(400);
    expect((await other.get(`/api/shipments/${shipment._id}`)).status).toBe(403);
    expect((await owner.patch(`/api/shipments/${missingId}/cancel`, {}, { idempotencyKey: 'missing-cancel' })).status).toBe(404);
    expect((await other.patch(`/api/shipments/${shipment._id}/cancel`, {}, { idempotencyKey: 'forbidden-cancel' })).status).toBe(403);

    const missingKey = await owner.patch(
      `/api/shipments/${shipment._id}/cancel`,
      {},
      { idempotency: false }
    );
    expect(missingKey.status).toBe(400);

    const longKey = await owner.patch(
      `/api/shipments/${shipment._id}/cancel`,
      {},
      { idempotencyKey: 'x'.repeat(129) }
    );
    expect(longKey.status).toBe(400);

    await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: driverUser._id });
    const nonPending = await owner.patch(
      `/api/shipments/${shipment._id}/cancel`,
      {},
      { idempotencyKey: 'non-pending-cancel' }
    );
    expect(nonPending.status).toBe(400);
  });

  test('covers driver list/detail/status edge cases', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { client: driver, user: driverUser } = await registerClient('driver');
    const { client: otherDriver } = await registerClient('driver');
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(shipper);
    const missingId = new mongoose.Types.ObjectId();

    expect((await driver.get('/api/driver/shipments?status=bad')).status).toBe(400);
    expect((await driver.get(`/api/driver/shipments/${missingId}`)).status).toBe(404);
    expect((await otherDriver.patch(`/api/driver/shipments/${shipment._id}/status`, { status: 'picked_up' })).status).toBe(403);

    await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, { driverId: driverUser._id });

    expect((await driver.patch(`/api/driver/shipments/${shipment._id}/status`, {})).status).toBe(422);
    expect((await driver.patch(`/api/driver/shipments/${shipment._id}/status`, { status: 'in_transit' })).status).toBe(400);
    expect((await driver.patch(`/api/driver/shipments/${missingId}/status`, { status: 'picked_up' })).status).toBe(404);

    const pickedUp = await driver.patch(`/api/driver/shipments/${shipment._id}/status`, { status: 'picked_up' });
    expect(pickedUp.status).toBe(200);

    expect((await driver.patch(`/api/driver/shipments/${shipment._id}/status`, { status: 'in_transit' })).status).toBe(200);
    expect((await driver.patch(`/api/driver/shipments/${shipment._id}/status`, { status: 'delivered' })).status).toBe(200);

    const deliveredOutbox = await waitFor(async () => {
      const event = await OutboxEvent.findOne({
        aggregateId: shipment._id,
        type: 'shipment.delivered',
        status: 'published',
      }).lean();
      return event || null;
    });
    expect(deliveredOutbox).toBeTruthy();
  });

  test('covers payment validation, ownership, duplicate, failure, and read branches', async () => {
    const { client: owner } = await registerClient('shipper');
    const { client: other } = await registerClient('shipper');
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(owner);
    const missingId = new mongoose.Types.ObjectId();

    expect((await owner.post(`/api/payments/initiate/${shipment._id}`, { paymentMethod: 'card' })).status).toBe(422);
    expect((await owner.post(`/api/payments/initiate/${shipment._id}`, { amount: -1, paymentMethod: 'card' })).status).toBe(422);
    expect((await owner.post(`/api/payments/initiate/${shipment._id}`, { amount: 10 })).status).toBe(422);
    expect((await owner.post(`/api/payments/initiate/${shipment._id}`, { amount: 10, paymentMethod: 'cash' })).status).toBe(422);
    expect((await owner.post(`/api/payments/initiate/${missingId}`, { amount: 10, paymentMethod: 'card' })).status).toBe(404);
    expect((await other.post(`/api/payments/initiate/${shipment._id}`, { amount: 10, paymentMethod: 'card' })).status).toBe(403);

    const initiated = await owner.post(`/api/payments/initiate/${shipment._id}`, {
      amount: 10,
      paymentMethod: 'card',
    });
    expect(initiated.status).toBe(201);
    expect((await owner.post(`/api/payments/initiate/${shipment._id}`, { amount: 10, paymentMethod: 'card' })).status).toBe(409);

    const paymentId = initiated.body.data.payment._id;
    expect((await owner.post(`/api/payments/confirm/${paymentId}`, {}, { idempotencyKey: 'confirm-missing-sim' })).status).toBe(422);
    expect((await owner.post(`/api/payments/confirm/${missingId}`, { simulate: 'success' }, { idempotencyKey: 'confirm-missing' })).status).toBe(404);
    expect((await other.post(`/api/payments/confirm/${paymentId}`, { simulate: 'success' }, { idempotencyKey: 'confirm-forbidden' })).status).toBe(403);

    const failed = await owner.post(
      `/api/payments/confirm/${paymentId}`,
      { simulate: 'failure' },
      { idempotencyKey: 'confirm-failure' }
    );
    expect(failed.status).toBe(200);
    expect(failed.body.data.payment.status).toBe('failed');

    expect((await owner.post(`/api/payments/confirm/${paymentId}`, { simulate: 'success' }, { idempotencyKey: 'confirm-after-fail' })).status).toBe(400);
    expect((await owner.get(`/api/payments/${missingId}`)).status).toBe(404);
    expect((await other.get(`/api/payments/${shipment._id}`)).status).toBe(403);
    expect((await admin.get(`/api/payments/${shipment._id}`)).status).toBe(200);
  });
});
