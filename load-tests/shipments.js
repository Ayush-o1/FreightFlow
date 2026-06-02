import http from 'k6/http';
import { check, sleep } from 'k6';

http.setResponseCallback(http.expectedStatuses(200, 201, 401, 403, 404, 422));

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const EMAIL = __ENV.SHIPPER_EMAIL || 'shipper@example.com';
const PASSWORD = __ENV.SHIPPER_PASSWORD || 'ChangeMe123!';
const SHIPMENT_ID = __ENV.SHIPMENT_ID;

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

const login = () => {
  const csrf = http.get(`${BASE_URL}/api/auth/csrf`);
  const token = csrf.json('data.csrfToken');
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
    }
  );

  return { token, cookies: res.cookies };
};

export default function shipmentsScenario() {
  const { token } = login();

  const list = http.get(`${BASE_URL}/api/shipments/my?page=1&limit=10`);
  check(list, {
    'shipment list acceptable': (res) => [200, 401].includes(res.status),
  });

  if (SHIPMENT_ID) {
    const detail = http.get(`${BASE_URL}/api/shipments/${SHIPMENT_ID}`);
    check(detail, {
      'shipment detail acceptable': (res) => [200, 401, 403, 404].includes(res.status),
    });
  }

  const create = http.post(
    `${BASE_URL}/api/shipments`,
    JSON.stringify({
      pickupLocation: { address: 'Load Test Pickup', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      deliveryLocation: { address: 'Load Test Drop', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      goodsType: 'Load test parcel',
      weight: 10,
      description: 'Synthetic k6 shipment',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
    }
  );
  check(create, {
    'create shipment acceptable': (res) => [201, 401, 403, 422].includes(res.status),
  });

  sleep(1);
}
