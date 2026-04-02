import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import prisma from '../../db';
import { buildApp, teardown, createTestUser, deleteUser, createTestVehicle } from '../helpers';

describe('Favorites routes', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;
  let vehicleId: string;

  beforeAll(async () => {
    app = await buildApp();
    const u = await createTestUser('fav');
    token = u.token;
    userId = u.user.id;
    const v = await createTestVehicle(userId);
    vehicleId = v.id;
  });

  afterAll(async () => {
    await deleteUser(userId); // cascades vehicle + favorites
    await teardown(app);
  });

  it('POST /favorites/:vehicleId — adds favorite, returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/favorites/${vehicleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /favorites/:vehicleId — duplicate returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/favorites/${vehicleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET /favorites — returns favorited vehicle with cover_image_url', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/favorites',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThan(0);
    const fav = body.find((f: { vehicle_id: string }) => f.vehicle_id === vehicleId);
    expect(fav).toBeDefined();
    expect(fav.vehicle).toMatchObject({ id: vehicleId });
    expect('cover_image_url' in fav.vehicle).toBe(true);
  });

  it('DELETE /favorites/:vehicleId — removes favorite, returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/favorites/${vehicleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
    const count = await prisma.favorite.count({ where: { user_id: userId, vehicle_id: vehicleId } });
    expect(count).toBe(0);
  });

  it('DELETE /favorites/:vehicleId — idempotent (no error if already removed)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/favorites/${vehicleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('POST /favorites/nonexistent — returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/favorites/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /favorites — returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/favorites' });
    expect(res.statusCode).toBe(401);
  });
});
