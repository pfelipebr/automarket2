import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import prisma from '../../db';
import { buildApp, teardown, createTestUser, deleteUser, createTestVehicle } from '../helpers';

// Mock storage so image upload tests don't hit a real MinIO
vi.mock('../../storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://example.com/minio/test-bucket/vehicles/test.jpg'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

describe('Vehicle routes', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerId: string;
  let otherToken: string;
  let otherId: string;

  beforeAll(async () => {
    app = await buildApp();
    const owner = await createTestUser('owner');
    ownerToken = owner.token;
    ownerId = owner.user.id;
    const other = await createTestUser('other');
    otherToken = other.token;
    otherId = other.user.id;
  });

  afterAll(async () => {
    await deleteUser(ownerId);
    await deleteUser(otherId);
    await teardown(app);
  });

  // ── GET /vehicles (non-geo) ──────────────────────────────────────────────────

  describe('GET /vehicles (without geo)', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId, { brand: 'Honda', price: 50000 });
      vehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    });

    it('returns paginated list with meta', async () => {
      const res = await app.inject({ method: 'GET', url: '/vehicles?limit=5&page=1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.meta).toMatchObject({ page: 1, limit: 5 });
    });

    it('filters by brand (case-insensitive)', async () => {
      const res = await app.inject({ method: 'GET', url: '/vehicles?brand=honda' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((v: { brand: string }) => v.brand.toLowerCase().includes('honda'))).toBe(true);
    });

    it('filters by max_price', async () => {
      const res = await app.inject({ method: 'GET', url: '/vehicles?max_price=49000' });
      const body = res.json();
      expect(body.data.every((v: { price: number }) => v.price <= 49000)).toBe(true);
    });

    it('does not return paused or sold vehicles', async () => {
      const paused = await createTestVehicle(ownerId, { status: 'paused' });
      const res = await app.inject({ method: 'GET', url: '/vehicles' });
      const ids = res.json().data.map((v: { id: string }) => v.id);
      expect(ids).not.toContain(paused.id);
      await prisma.vehicle.delete({ where: { id: paused.id } });
    });
  });

  // ── GET /vehicles (geo-search — uses earth_distance extension) ───────────────

  describe('GET /vehicles (with geo)', () => {
    let geoVehicleId: string;
    // Place vehicle in São Paulo
    const vehicleLat = -23.5505;
    const vehicleLng = -46.6333;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId, { lat: vehicleLat, lng: vehicleLng, brand: 'GeoTest' });
      geoVehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: geoVehicleId } }).catch(() => {});
    });

    it('returns vehicle when searching within radius', async () => {
      // Search from 1km away
      const res = await app.inject({
        method: 'GET',
        url: `/vehicles?lat=${vehicleLat + 0.005}&lng=${vehicleLng + 0.005}&radius_km=5`,
      });
      expect(res.statusCode).toBe(200);
      const ids = res.json().data.map((v: { id: string }) => v.id);
      expect(ids).toContain(geoVehicleId);
    });

    it('excludes vehicle when outside radius', async () => {
      // Search from Rio de Janeiro (~360km away), radius 10km
      const res = await app.inject({
        method: 'GET',
        url: `/vehicles?lat=-22.9068&lng=-43.1729&radius_km=10`,
      });
      expect(res.statusCode).toBe(200);
      const ids = res.json().data.map((v: { id: string }) => v.id);
      expect(ids).not.toContain(geoVehicleId);
    });

    it('includes distance_km in response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/vehicles?lat=${vehicleLat}&lng=${vehicleLng}&radius_km=5`,
      });
      const vehicle = res.json().data.find((v: { id: string }) => v.id === geoVehicleId);
      expect(vehicle).toBeDefined();
      expect(vehicle.distance_km).toBeTypeOf('number');
    });
  });

  // ── GET /vehicles/:id ────────────────────────────────────────────────────────

  describe('GET /vehicles/:id', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId);
      vehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    });

    it('returns full vehicle with features and images arrays', async () => {
      const res = await app.inject({ method: 'GET', url: `/vehicles/${vehicleId}` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(vehicleId);
      expect(body.images).toBeInstanceOf(Array);
    });

    it('returns 404 for unknown id', async () => {
      const res = await app.inject({ method: 'GET', url: '/vehicles/00000000-0000-0000-0000-000000000000' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /vehicles ───────────────────────────────────────────────────────────

  describe('POST /vehicles', () => {
    const validPayload = {
      brand: 'Fiat',
      model: 'Uno',
      year_fab: 2019,
      year_model: 2020,
      mileage_km: 30000,
      price: 35000,
      condition: 'used',
      lat: -23.5505,
      lng: -46.6333,
      city: 'São Paulo',
      state: 'SP',
    };

    it('creates a vehicle and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/vehicles',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: validPayload,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.brand).toBe('Fiat');
      await prisma.vehicle.delete({ where: { id: body.id } });
    });

    it('creates vehicle with features when provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/vehicles',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          ...validPayload,
          features: { transmission: 'manual', fuel: 'flex', color: 'branco', doors: 4, ac: true, power_steering: true, abs: false, airbags: 2 },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.features.transmission).toBe('manual');
      await prisma.vehicle.delete({ where: { id: body.id } });
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/vehicles',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { brand: 'Test' }, // missing most fields
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 401 without Bearer token', async () => {
      const res = await app.inject({ method: 'POST', url: '/vehicles', payload: validPayload });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── PATCH /vehicles/:id ──────────────────────────────────────────────────────

  describe('PATCH /vehicles/:id', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId);
      vehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    });

    it('owner can update price', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/vehicles/${vehicleId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { price: 99000 },
      });
      expect(res.statusCode).toBe(200);
      expect(Number(res.json().price)).toBe(99000);
    });

    it('returns 403 when another user tries to update', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/vehicles/${vehicleId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { price: 1 },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── DELETE /vehicles/:id ─────────────────────────────────────────────────────

  describe('DELETE /vehicles/:id', () => {
    it('owner can delete their vehicle', async () => {
      const v = await createTestVehicle(ownerId);
      const res = await app.inject({
        method: 'DELETE',
        url: `/vehicles/${v.id}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 403 when another user tries to delete', async () => {
      const v = await createTestVehicle(ownerId);
      const res = await app.inject({
        method: 'DELETE',
        url: `/vehicles/${v.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(403);
      await prisma.vehicle.delete({ where: { id: v.id } });
    });
  });

  // ── PATCH /vehicles/:id/status ───────────────────────────────────────────────

  describe('PATCH /vehicles/:id/status', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId);
      vehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    });

    it('owner can pause a vehicle', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/vehicles/${vehicleId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'paused' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('paused');
    });

    it('owner can mark vehicle as sold', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/vehicles/${vehicleId}/status`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { status: 'sold' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('sold');
    });
  });

  // ── POST /vehicles/:id/images ────────────────────────────────────────────────

  describe('POST /vehicles/:id/images', () => {
    let vehicleId: string;

    beforeAll(async () => {
      const v = await createTestVehicle(ownerId);
      vehicleId = v.id;
    });

    afterAll(async () => {
      await prisma.vehicle.delete({ where: { id: vehicleId } }).catch(() => {});
    });

    it('uploads image and first one becomes cover', async () => {
      // Minimal valid JPEG header
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
        0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
      ]);

      const boundary = '----TestBoundary';
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="test.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n` +
        jpegBuffer.toString('binary') +
        `\r\n--${boundary}--\r\n`;

      const res = await app.inject({
        method: 'POST',
        url: `/vehicles/${vehicleId}/images`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });
      expect(res.statusCode).toBe(201);
      const imgs = res.json().images;
      expect(imgs.length).toBe(1);
      expect(imgs[0].is_cover).toBe(true);
    });

    it('returns 403 when another user uploads to a vehicle they do not own', async () => {
      const boundary = '----TestBoundary2';
      const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="x.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n` +
        'fakedata' +
        `\r\n--${boundary}--\r\n`;

      const res = await app.inject({
        method: 'POST',
        url: `/vehicles/${vehicleId}/images`,
        headers: {
          authorization: `Bearer ${otherToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
