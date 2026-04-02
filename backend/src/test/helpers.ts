import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import prisma from '../db';
import { config } from '../config';

export async function buildApp(): Promise<FastifyInstance> {
  const app = await createApp({ logger: false });
  await app.ready();
  return app;
}

export async function teardown(app: FastifyInstance): Promise<void> {
  await app.close();
}

// Creates a test user directly in the DB and returns a signed JWT — no HTTP round-trip.
export async function createTestUser(emailPrefix = 'user') {
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const password_hash = await bcrypt.hash('TestPass123!', 10);
  const user = await prisma.user.create({
    data: { name: 'Test User', email, password_hash },
  });
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: '15m' },
  );
  return { user, token };
}

export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

// Creates a minimal vehicle owned by userId (no features, no images)
export async function createTestVehicle(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.vehicle.create({
    data: {
      user_id: userId,
      brand: 'Toyota',
      model: 'Corolla',
      year_fab: 2020,
      year_model: 2021,
      mileage_km: 50000,
      price: 80000,
      condition: 'used',
      lat: -23.5505,
      lng: -46.6333,
      city: 'São Paulo',
      state: 'SP',
      ...overrides,
    },
  });
}
