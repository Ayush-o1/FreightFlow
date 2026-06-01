import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import axiosInstance, { clearCsrfToken } from './axiosInstance';

let mock;

describe('axiosInstance', () => {
  beforeEach(() => {
    mock = new MockAdapter(axiosInstance);
    clearCsrfToken();
  });

  afterEach(() => {
    mock.restore();
    clearCsrfToken();
  });

  test('bootstraps CSRF token and attaches it to unsafe requests', async () => {
    mock.onGet('/api/auth/csrf').reply(200, {
      data: { csrfToken: 'csrf-token-1' },
    });

    mock.onPost('/api/shipments').reply((config) => {
      expect(config.headers['X-CSRF-Token']).toBe('csrf-token-1');
      return [201, { success: true }];
    });

    const res = await axiosInstance.post('/api/shipments', { goodsType: 'Electronics' });
    expect(res.status).toBe(201);
    expect(mock.history.get).toHaveLength(1);
  });

  test('refreshes stale CSRF tokens once and retries the original request', async () => {
    mock
      .onGet('/api/auth/csrf')
      .replyOnce(200, { data: { csrfToken: 'old-token' } })
      .onGet('/api/auth/csrf')
      .replyOnce(200, { data: { csrfToken: 'new-token' } });

    mock
      .onPatch('/api/shipments/1/cancel')
      .replyOnce(403, { message: 'CSRF validation failed. Refresh the page and try again.' })
      .onPatch('/api/shipments/1/cancel')
      .reply((config) => {
        expect(config.headers['X-CSRF-Token']).toBe('new-token');
        expect(config.headers['Idempotency-Key']).toBeTruthy();
        return [200, { success: true }];
      });

    const res = await axiosInstance.patch('/api/shipments/1/cancel', {});
    expect(res.status).toBe(200);
    expect(mock.history.patch).toHaveLength(2);
  });

  test('refreshes session after a 401 and retries the original request', async () => {
    mock
      .onGet('/api/protected')
      .replyOnce(401, { message: 'expired' })
      .onGet('/api/protected')
      .replyOnce(200, { success: true, data: { ok: true } });

    mock.onGet('/api/auth/csrf').reply(200, { data: { csrfToken: 'csrf-token' } });
    mock.onPost('/api/auth/refresh').reply(200, { success: true });

    const res = await axiosInstance.get('/api/protected');
    expect(res.status).toBe(200);
    expect(mock.history.post.some((req) => req.url === '/api/auth/refresh')).toBe(true);
  });

  test('rejects when refresh fails and redirects to login', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    mock.onGet('/api/protected').replyOnce(401, { message: 'expired' });
    mock.onPost('/api/auth/refresh').replyOnce(401, { message: 'invalid refresh' });

    await expect(axiosInstance.get('/api/protected')).rejects.toBeTruthy();
    expect(window.location.href).toBe('/login');

    window.location = originalLocation;
  });
});
