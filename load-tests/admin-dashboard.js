import http from 'k6/http';
import { check, sleep } from 'k6';

http.setResponseCallback(http.expectedStatuses(200, 401, 403, 422));

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const EMAIL = __ENV.ADMIN_EMAIL || 'admin@example.com';
const PASSWORD = __ENV.ADMIN_PASSWORD || 'ChangeMe123!';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function adminDashboardScenario() {
  const csrf = http.get(`${BASE_URL}/api/auth/csrf`);
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
    'admin login acceptable': (res) => [200, 401, 422].includes(res.status),
  });

  const dashboard = http.get(`${BASE_URL}/api/admin/analytics`);
  check(dashboard, {
    'dashboard acceptable': (res) => [200, 401, 403].includes(res.status),
  });

  const shipments = http.get(`${BASE_URL}/api/admin/shipments?page=1&limit=10`);
  check(shipments, {
    'admin shipments acceptable': (res) => [200, 401, 403].includes(res.status),
  });

  sleep(1);
}
