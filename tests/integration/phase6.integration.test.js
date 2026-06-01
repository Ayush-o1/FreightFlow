'use strict';

const { io } = require('socket.io-client');
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
const { getRedisClient, getRedisReadiness } = require('../../src/config/redis');
const { getAuditQueue, getNotificationQueue, getOutboxQueue } = require('../../src/queues');
const { createAndEnqueueOutboxEvent } = require('../../src/services/outboxService');
const { getAdminAnalytics } = require('../../src/services/analyticsService');
const {
  recoverPendingOutboxEvents,
  runRecoverySweep,
} = require('../../src/jobs/recoveryJobs');
const User = require('../../src/models/User');
const Shipment = require('../../src/models/Shipment');
const Payment = require('../../src/models/Payment');
const AuditLog = require('../../src/models/AuditLog');
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

const connectSocket = (client, targetUrl = baseUrl) =>
  new Promise((resolve) => {
    const socket = io(targetUrl, {
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
  process.env.ENABLE_RATE_LIMITS_IN_TEST = 'false';
});

afterAll(async () => {
  await stopTestServer();
  await stopTestRedis();
  await disconnectTestDb();
});

describe('Redis, queues, outbox, and recovery', () => {
  test('connects to Redis and processes BullMQ audit, notification, and outbox jobs', async () => {
    const readiness = await getRedisReadiness();
    expect(readiness.ready).toBe(true);

    const user = await createUser('shipper');
    await getAuditQueue().add('writeAuditLog', {
      action: 'phase6.audit_test',
      actor: user._id,
      actorRole: user.role,
      targetType: 'User',
      targetId: user._id,
      metadata: { queue: true },
    });

    await getNotificationQueue().add('deliverNotification', {
      type: 'shipment.created',
      payload: { shipmentId: user._id.toString() },
    });

    const outboxEvent = await createAndEnqueueOutboxEvent({
      type: 'shipment.created',
      aggregateType: 'Shipment',
      aggregateId: user._id,
      payload: {
        notification: {
          type: 'shipment.created',
          payload: { shipmentId: user._id.toString() },
        },
      },
    });

    const audit = await waitFor(() => AuditLog.findOne({ action: 'phase6.audit_test' }).lean());
    expect(audit).toBeTruthy();

    const published = await waitFor(async () => {
      const event = await OutboxEvent.findById(outboxEvent._id).lean();
      return event?.status === 'published' ? event : null;
    });
    expect(published.status).toBe('published');

    const notificationCounts = await getNotificationQueue().getJobCounts('completed');
    expect(notificationCounts.completed).toBeGreaterThanOrEqual(1);
  });

  test('recovers pending outbox events and reports stale operational work', async () => {
    const staleUser = await createUser('shipper');
    const pendingEvent = await OutboxEvent.create({
      type: 'shipment.created',
      aggregateType: 'Shipment',
      aggregateId: staleUser._id,
      payload: {
        notification: {
          type: 'shipment.created',
          payload: { shipmentId: staleUser._id.toString() },
        },
      },
      availableAt: new Date(Date.now() - 1000),
    });

    const outboxReport = await recoverPendingOutboxEvents();
    expect(outboxReport.discovered).toBe(1);
    expect(outboxReport.eventIds).toContain(pendingEvent._id.toString());

    const report = await runRecoverySweep();
    expect(report.outbox).toBeTruthy();
    expect(report.queues).toHaveProperty('auditJobsRetried');
  });
});

describe('distributed rate limiting and idempotency', () => {
  test('shares Redis-backed rate limit counters across server instances', async () => {
    process.env.ENABLE_RATE_LIMITS_IN_TEST = 'true';
    const secondServer = await startTestServer();

    try {
      const clientOne = new TestClient(baseUrl);
      const clientTwo = new TestClient(secondServer.baseUrl);
      await clientOne.csrf();
      await clientTwo.csrf();

      for (let i = 0; i < 10; i += 1) {
        const res = await clientOne.post('/api/auth/login', {
          email: `missing-${i}@test.local`,
          password: PASSWORD,
        });
        expect([401, 403]).toContain(res.status);
      }

      const limited = await clientTwo.post('/api/auth/login', {
        email: 'missing-final@test.local',
        password: PASSWORD,
      });
      expect(limited.status).toBe(429);
    } finally {
      await stopTestServer();
      process.env.ENABLE_RATE_LIMITS_IN_TEST = 'false';
    }
  });

  test('replays duplicate payment confirmations without duplicating side effects', async () => {
    const { client: shipper } = await registerClient('shipper');
    const shipment = await createShipmentFor(shipper);

    const initiated = await shipper.post(`/api/payments/initiate/${shipment._id}`, {
      amount: 1500,
      paymentMethod: 'card',
    });
    const paymentId = initiated.body.data.payment._id;

    const key = 'payment-confirm-once';
    const first = await shipper.post(
      `/api/payments/confirm/${paymentId}`,
      { simulate: 'success' },
      { idempotencyKey: key }
    );
    expect(first.status).toBe(200);

    const replay = await shipper.post(
      `/api/payments/confirm/${paymentId}`,
      { simulate: 'success' },
      { idempotencyKey: key }
    );
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');

    const paidPayments = await Payment.countDocuments({ _id: paymentId, status: 'paid' });
    expect(paidPayments).toBe(1);
  });
});

describe('cache, atomic transitions, and socket scaling', () => {
  test('caches admin analytics and invalidates cache after mutations', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { client: admin } = await createAdminClient();

    await createShipmentFor(shipper);

    const first = await admin.get('/api/admin/analytics');
    expect(first.status).toBe(200);
    expect(first.body.data.cache).toBe('miss');

    const second = await admin.get('/api/admin/analytics');
    expect(second.status).toBe(200);
    expect(second.body.data.cache).toBe('hit');

    await createShipmentFor(shipper);
    const afterInvalidation = await admin.get('/api/admin/analytics');
    expect(afterInvalidation.body.data.cache).toBe('miss');

    const direct = await getAdminAnalytics();
    expect(direct.cache).toBe('hit');
  });

  test('uses atomic shipment assignment and cancellation guards', async () => {
    const { client: shipper } = await registerClient('shipper');
    const { user: driverUser } = await registerClient('driver');
    const { client: admin } = await createAdminClient();
    const shipment = await createShipmentFor(shipper);

    const assignKey = 'assign-once';
    const assigned = await admin.patch(
      `/api/admin/shipments/${shipment._id}/assign`,
      { driverId: driverUser._id },
      { idempotencyKey: assignKey }
    );
    expect(assigned.status).toBe(200);

    const conflict = await admin.patch(
      `/api/admin/shipments/${shipment._id}/assign`,
      { driverId: driverUser._id },
      { idempotencyKey: 'assign-again' }
    );
    expect(conflict.status).toBe(409);

    const cancel = await shipper.patch(
      `/api/shipments/${shipment._id}/cancel`,
      {},
      { idempotencyKey: 'shipper-cancel-after-assign' }
    );
    expect(cancel.status).toBe(400);
  });

  test('propagates Socket.IO room events across Redis-backed server instances', async () => {
    const secondServer = await startTestServer();

    try {
      const { client: shipper } = await registerClient('shipper');
      const { user: driverUser } = await registerClient('driver');
      const { client: admin } = await createAdminClient();
      const shipment = await createShipmentFor(shipper);

      const ownerConnection = await connectSocket(shipper, baseUrl);
      expect(ownerConnection.socket.connected).toBe(true);

      const ownerAck = await joinRoom(ownerConnection.socket, shipment._id);
      expect(ownerAck.success).toBe(true);
      ownerConnection.socket.emit('leaveShipmentRoom', { shipmentId: shipment._id });
      await new Promise((resolve) => setTimeout(resolve, 50));

      const rejoinAck = await joinRoom(ownerConnection.socket, shipment._id);
      expect(rejoinAck.success).toBe(true);

      const assignmentEvent = new Promise((resolve) => {
        ownerConnection.socket.once('driverAssigned', resolve);
      });

      const assign = await admin.patch(`/api/admin/shipments/${shipment._id}/assign`, {
        driverId: driverUser._id,
      });
      expect(assign.status).toBe(200);

      const payload = await assignmentEvent;
      expect(payload.shipmentId).toBe(shipment._id);

      ownerConnection.socket.disconnect();
    } finally {
      await stopTestServer();
    }
  });
});
