import http from 'k6/http';
import { check, sleep } from 'k6';

http.setResponseCallback(http.expectedStatuses(200, 201, 401, 422));

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const EMAIL = __ENV.SHIPPER_EMAIL || 'shipper@example.com';
const PASSWORD = __ENV.SHIPPER_PASSWORD || 'ChangeMe123!';

export const options = {
  scenarios: {
    auth_baseline: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<750'],
  },
};

export default function authScenario() {
  const csrf = http.get(`${BASE_URL}/api/auth/csrf`);
  check(csrf, {
    'csrf ok': (res) => res.status === 200,
  });

  const token = csrf.json('data.csrfToken');
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
    }
  );

  check(login, {
    'login status is 200 or seeded-user missing': (res) => [200, 401, 422].includes(res.status),
  });

  sleep(1);
}
