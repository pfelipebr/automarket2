import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import prisma from '../../db';
import { buildApp, teardown } from '../helpers';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await teardown(app);
  });

  // ── POST /auth/register ──────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates user and returns access_token + user object', async () => {
      const email = `reg_ok_${Date.now()}@test.com`;
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Maria', email, password: 'pass123' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user.email).toBe(email);
      expect(body.access_token).toBeDefined();
      expect(body.user.password_hash).toBeUndefined(); // never leak hash

      await prisma.user.delete({ where: { email } });
    });

    it('returns 409 for duplicate email', async () => {
      const email = `reg_dup_${Date.now()}@test.com`;
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Dup', email, password: 'pass123' },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Dup2', email, password: 'pass123' },
      });
      expect(res.statusCode).toBe(409);
      await prisma.user.delete({ where: { email } });
    });

    it('returns 400 for invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Test', email: 'not-an-email', password: 'pass123' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for password shorter than 6 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Test', email: 'valid@test.com', password: '123' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for name shorter than 2 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'X', email: 'valid2@test.com', password: 'pass123' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const email = `login_${Date.now()}@test.com`;

    beforeAll(async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Login User', email, password: 'TestPass123!' },
      });
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { email } }).catch(() => {});
    });

    it('returns 200 with tokens on valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'TestPass123!' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.access_token).toBeDefined();
      expect(body.user.email).toBe(email);
    });

    it('returns 401 for wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'ghost@test.com', password: 'pass123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns new access_token with valid refresh cookie', async () => {
      const email = `refresh_${Date.now()}@test.com`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Refresh User', email, password: 'pass123!' },
      });
      const setCookie = regRes.headers['set-cookie'] as string | string[];
      const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().access_token).toBeDefined();
      await prisma.user.delete({ where: { email } }).catch(() => {});
    });

    it('returns 401 when refresh cookie is absent', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/refresh' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 200 and clears cookie for authenticated user', async () => {
      const email = `logout_${Date.now()}@test.com`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { name: 'Logout User', email, password: 'pass123!' },
      });
      const { access_token } = regRes.json();

      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${access_token}` },
      });
      expect(res.statusCode).toBe(200);
      await prisma.user.delete({ where: { email } }).catch(() => {});
    });

    it('returns 401 without a valid Bearer token', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /auth/forgot-password ───────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 (anti-enumeration)', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'nonexistent@test.com' },
      });
      expect(res1.statusCode).toBe(200);
    });
  });
});
