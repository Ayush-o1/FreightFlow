import http from 'k6/http';
import { check, sleep } from 'k6';

http.setResponseCallback(http.expectedStatuses(200, 400, 401, 422));

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const EMAIL = __ENV.SHIPPER_EMAIL || 'shipper@example.com';
const PASSWORD = __ENV.SHIPPER_PASSWORD || 'ChangeMe123!';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<1000'],
  },
};

const login = () => {
  const csrf = http.get(`${BASE_URL}/api/auth/csrf`);
  const token = csrf.json('data.csrfToken');
  return http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
    }
  );
};

export default function socketTrafficScenario() {
  login();

  const handshake = http.get(`${BASE_URL}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`);
  check(handshake, {
    'engine.io handshake reachable': (res) => [200, 400, 401].includes(res.status),
  });

  sleep(1);
}
