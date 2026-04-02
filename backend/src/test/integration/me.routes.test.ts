import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, teardown, createTestUser, deleteUser, createTestVehicle } from '../helpers';

describe('Me routes', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();
    const u = await createTestUser('me');
    token = u.token;
    userId = u.user.id;
  });

  afterAll(async () => {
    await deleteUser(userId);
    await teardown(app);
  });

  describe('GET /me', () => {
    it('returns authenticated user profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(userId);
      expect(body.password_hash).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /me', () => {
    it('updates user name', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated Name' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Updated Name');
    });

    it('updates phone', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { phone: '11999998888' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().phone).toBe('11999998888');
    });

    it('returns 400 when name is too short', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'X' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /me/vehicles', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(userId, { brand: 'MyVehicle' });
      vehicleId = v.id;
    });

    it('returns only vehicles owned by the authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/me/vehicles',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toBeInstanceOf(Array);
      const ids = body.map((v: { id: string }) => v.id);
      expect(ids).toContain(vehicleId);
      // All returned vehicles must belong to this user
      expect(body.every((v: { status: string }) => 'status' in v)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/me/vehicles' });
      expect(res.statusCode).toBe(401);
    });
  });
});
