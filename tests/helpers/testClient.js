'use strict';

const request = require('supertest');

const splitSetCookie = (header) => {
  if (!header) return [];
  if (Array.isArray(header)) return header;
  return String(header).split(/,(?=\s*[^;,\s]+=)/g);
};

class TestClient {
  constructor(target) {
    this.target = target;
    this.cookies = new Map();
    this.csrfToken = null;
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  ingestCookies(res) {
    const setCookies = splitSetCookie(res.headers['set-cookie']);
    setCookies.forEach((cookie) => {
      const [pair] = cookie.split(';');
      const idx = pair.indexOf('=');
      if (idx === -1) return;
      const key = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    });
  }

  async csrf() {
    const res = await this.get('/api/auth/csrf');
    this.csrfToken = res.body.data.csrfToken;
    return res;
  }

  async request(method, path, body, options = {}) {
    const req = request(this.target)[method](path);
    const cookie = this.cookieHeader();

    if (cookie) req.set('Cookie', cookie);
    if (options.requestId) req.set('X-Request-ID', options.requestId);
    if (options.idempotencyKey) req.set('Idempotency-Key', options.idempotencyKey);

    const unsafe = ['post', 'put', 'patch', 'delete'].includes(method);
    if (unsafe && options.csrf !== false && this.csrfToken) {
      req.set('X-CSRF-Token', this.csrfToken);
    }
    if (unsafe && options.idempotency !== false && !options.idempotencyKey) {
      req.set('Idempotency-Key', `test-${method}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }

    if (body !== undefined) req.send(body);

    const res = await req;
    this.ingestCookies(res);
    return res;
  }

  get(path, options) { return this.request('get', path, undefined, options); }
  post(path, body, options) { return this.request('post', path, body, options); }
  patch(path, body, options) { return this.request('patch', path, body, options); }
  delete(path, options) { return this.request('delete', path, undefined, options); }
}

module.exports = TestClient;
