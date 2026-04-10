import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Transmission, Fuel } from '@prisma/client';
import prisma from '../db';
import { config } from '../config';
import { getFailureState, setFailureState, clearFailureState } from '../failureState';

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_NEIGHBORHOODS = [
  { name: 'Pinheiros',      lat: -23.5629, lng: -46.6946 },
  { name: 'Vila Madalena',  lat: -23.5531, lng: -46.6916 },
  { name: 'Santo Amaro',    lat: -23.6516, lng: -46.7070 },
  { name: 'Brooklin',       lat: -23.6196, lng: -46.6929 },
  { name: 'Centro',         lat: -23.5505, lng: -46.6333 },
];

const SAMPLE_MODELS = [
  { brand: 'Chevrolet', model: 'Onix',    version: 'LTZ Turbo', priceMin: 65000, priceMax: 95000,  fuel: 'flex' as const,    transmission: 'automatic' as const, doors: 4 },
  { brand: 'Hyundai',   model: 'Creta',   version: 'Limited',   priceMin: 110000, priceMax: 160000, fuel: 'flex' as const,    transmission: 'automatic' as const, doors: 4 },
  { brand: 'Toyota',    model: 'Hilux',   version: 'SRX',       priceMin: 200000, priceMax: 320000, fuel: 'diesel' as const,  transmission: 'automatic' as const, doors: 4 },
  { brand: 'Jeep',      model: 'Compass', version: 'Limited',   priceMin: 170000, priceMax: 245000, fuel: 'flex' as const,    transmission: 'automatic' as const, doors: 4 },
  { brand: 'Volkswagen',model: 'Polo',    version: 'TSI',       priceMin: 75000,  priceMax: 115000, fuel: 'flex' as const,    transmission: 'automatic' as const, doors: 4 },
  { brand: 'Fiat',      model: 'Strada',  version: 'Volcano',   priceMin: 85000,  priceMax: 130000, fuel: 'flex' as const,    transmission: 'manual' as const,    doors: 2 },
  { brand: 'Honda',     model: 'HR-V',    version: 'EXL',       priceMin: 115000, priceMax: 175000, fuel: 'flex' as const,    transmission: 'cvt' as const,       doors: 4 },
  { brand: 'Renault',   model: 'Kwid',    version: 'Intense',   priceMin: 50000,  priceMax: 78000,  fuel: 'flex' as const,    transmission: 'manual' as const,    doors: 4 },
];

const SAMPLE_USERS = [
  { name: 'Carlos Eduardo Silva', email: 'carlos.silva@demo.com',   phone: '(11) 99123-4567' },
  { name: 'Ana Paula Ferreira',   email: 'ana.ferreira@demo.com',   phone: '(11) 98234-5678' },
  { name: 'Roberto Alves',        email: 'roberto.alves@demo.com',  phone: '(11) 97345-6789' },
  { name: 'Mariana Costa',        email: 'mariana.costa@demo.com',  phone: '(11) 96456-7890' },
  { name: 'AutoSP Multimarcas',   email: 'vendas@autospdemo.com',   phone: '(11) 3456-7890' },
];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function jitter(coord: number, range = 0.01): number {
  return coord + (Math.random() - 0.5) * range * 2;
}

// ─── Admin guard ─────────────────────────────────────────────────────────────

function guardAdmin(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const key = req.headers['x-admin-key'];
  return key === config.adminSecret;
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /admin/status ─────────────────────────────────────────────────────
  fastify.get('/status', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    const [userCount, vehicleCount, favoriteCount] = await Promise.all([
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.favorite.count(),
    ]);

    const failure = await getFailureState();
    return {
      db: { users: userCount, vehicles: vehicleCount, favorites: favoriteCount },
      failure: {
        active: !!failure,
        until: failure?.failUntil ?? null,
        reason: failure?.reason ?? '',
        failureRate: failure?.failureRate ?? 0,
      },
    };
  });

  // ── DELETE /admin/reset ───────────────────────────────────────────────────
  fastify.delete('/reset', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    // Delete in dependency order
    await prisma.refreshToken.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.vehicleImage.deleteMany({});
    await prisma.vehicleFeatures.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.user.deleteMany({});

    return { ok: true, message: 'All data deleted' };
  });

  // ── POST /admin/seed ──────────────────────────────────────────────────────
  fastify.post('/seed', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    const bodySchema = z.object({
      vehicles: z.number().int().min(1).max(500).default(50),
    });
    const { vehicles: targetCount } = bodySchema.parse(req.body ?? {});

    const passwordHash = await bcrypt.hash('Senha@123', 10);

    // Create users (skip existing emails)
    const createdUsers: string[] = [];
    for (const u of SAMPLE_USERS) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        createdUsers.push(existing.id);
      } else {
        const user = await prisma.user.create({
          data: { name: u.name, email: u.email, password_hash: passwordHash, phone: u.phone },
        });
        createdUsers.push(user.id);
      }
    }

    // Create vehicles
    let created = 0;
    for (let i = 0; i < targetCount; i++) {
      const m = pick(SAMPLE_MODELS);
      const hood = pick(SAMPLE_NEIGHBORHOODS);
      const yearFab = rnd(2018, 2024);
      const price = rnd(m.priceMin, m.priceMax);

      await prisma.vehicle.create({
        data: {
          user_id:    pick(createdUsers),
          brand:      m.brand,
          model:      m.model,
          version:    m.version,
          year_fab:   yearFab,
          year_model: Math.min(yearFab + 1, 2025),
          mileage_km: rnd(0, (2024 - yearFab) * 18000),
          price,
          condition:  pick(['used', 'used', 'used', 'certified', 'new']),
          description: `${m.brand} ${m.model} ${m.version} em ótimo estado. IPVA pago.`,
          lat:         jitter(hood.lat),
          lng:         jitter(hood.lng),
          neighborhood: hood.name,
          city:        'São Paulo',
          state:       'SP',
          status:      'active',
          features: {
            create: {
              transmission: m.transmission as Transmission,
              fuel:         m.fuel as Fuel,
              color:        pick(['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho']),
              doors:        m.doors,
              ac:           true,
              power_steering: true,
              abs:          true,
              airbags:      rnd(2, 8),
            },
          },
        },
      });
      created++;
    }

    return { ok: true, usersReady: createdUsers.length, vehiclesCreated: created };
  });

  // ── POST /admin/load ──────────────────────────────────────────────────────
  fastify.post('/load', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    const bodySchema = z.object({
      requests:    z.number().int().min(1).max(1000).default(200),
      concurrency: z.number().int().min(1).max(50).default(20),
    });
    const { requests, concurrency } = bodySchema.parse(req.body ?? {});

    // Realistic search scenarios that mimic real user traffic
    const BASE_URL = `http://localhost:${config.port}`;
    const SCENARIOS = [
      () => `${BASE_URL}/vehicles?limit=20&sort=newest&page=${rnd(1, 5)}`,
      () => `${BASE_URL}/vehicles?limit=20&sort=price_asc`,
      () => `${BASE_URL}/vehicles?limit=20&sort=price_desc`,
      () => `${BASE_URL}/vehicles?brand=${pick(['Chevrolet','Hyundai','Volkswagen','Fiat','Toyota'])}&limit=20`,
      () => `${BASE_URL}/vehicles?min_price=${rnd(50,100) * 1000}&max_price=${rnd(150,300) * 1000}&limit=20`,
      () => `${BASE_URL}/vehicles?fuel=${pick(['flex','diesel','hybrid','electric'])}&limit=20`,
      () => `${BASE_URL}/vehicles?condition=${pick(['new','used','certified'])}&limit=20`,
      () => `${BASE_URL}/vehicles?lat=-23.5505&lng=-46.6333&radius_km=${rnd(5,50)}&limit=20`,
      () => `${BASE_URL}/vehicles?transmission=${pick(['manual','automatic','cvt'])}&limit=20`,
      () => `${BASE_URL}/vehicles?year_from=${rnd(2015,2020)}&year_to=${rnd(2021,2024)}&limit=20`,
    ];

    const start = Date.now();
    let completed = 0;
    let errors = 0;
    const statusCodes: Record<number, number> = {};

    const runBatch = async (size: number) => {
      const tasks = Array.from({ length: size }, async () => {
        const url = pick(SCENARIOS)();
        try {
          const res = await fetch(url);
          statusCodes[res.status] = (statusCodes[res.status] ?? 0) + 1;
          if (res.ok) completed++;
          else errors++;
        } catch {
          errors++;
        }
      });
      await Promise.all(tasks);
    };

    const fullBatches = Math.floor(requests / concurrency);
    const lastBatch = requests % concurrency;
    for (let i = 0; i < fullBatches; i++) await runBatch(concurrency);
    if (lastBatch > 0) await runBatch(lastBatch);

    const elapsed = Date.now() - start;
    return {
      ok: true,
      requests,
      completed,
      errors,
      status_codes: statusCodes,
      elapsed_ms: elapsed,
      rps: Math.round((completed / elapsed) * 1000),
    };
  });

  // ── POST /admin/simulate-failure ─────────────────────────────────────────
  fastify.post('/simulate-failure', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    const bodySchema = z.object({
      duration_seconds: z.number().int().min(5).max(300).default(30),
      failure_rate: z.number().min(0.1).max(1.0).default(0.5),
      reason: z.string().max(120).default('Simulated failure triggered from admin panel'),
    });
    const { duration_seconds, failure_rate, reason } = bodySchema.parse(req.body ?? {});

    const until = new Date(Date.now() + duration_seconds * 1000);
    await setFailureState({ failUntil: until.toISOString(), reason, failureRate: failure_rate });

    return {
      ok: true,
      failUntil: until,
      duration_seconds,
      failure_rate,
      reason,
    };
  });

  // ── DELETE /admin/simulate-failure ───────────────────────────────────────
  fastify.delete('/simulate-failure', async (req, reply) => {
    if (!guardAdmin(req)) return reply.code(401).send({ error: 'Unauthorized' });

    await clearFailureState();

    return { ok: true, message: 'Failure simulation cleared' };
  });
};

export default adminRoutes;
