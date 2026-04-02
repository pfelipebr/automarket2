import { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db';
import { uploadFile, deleteFile } from '../storage';

const vehicleRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /vehicles
  fastify.get('/', async (req) => {
    const querySchema = z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
      radius_km: z.coerce.number().default(100),
      brand: z.string().optional(),
      model: z.string().optional(),
      condition: z.enum(['new', 'used', 'certified']).optional(),
      min_price: z.coerce.number().optional(),
      max_price: z.coerce.number().optional(),
      min_km: z.coerce.number().optional(),
      max_km: z.coerce.number().optional(),
      year_from: z.coerce.number().optional(),
      year_to: z.coerce.number().optional(),
      fuel: z.enum(['flex', 'gasoline', 'diesel', 'electric', 'hybrid']).optional(),
      transmission: z.enum(['manual', 'automatic', 'cvt']).optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(50).default(20),
      sort: z
        .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'nearest'])
        .default('relevance'),
    });
    const q = querySchema.parse(req.query);
    const offset = (q.page - 1) * q.limit;

    if (q.lat !== undefined && q.lng !== undefined) {
      const radiusMeters = q.radius_km * 1000;

      // Build extra WHERE conditions and param array
      const extraConditions: Prisma.Sql[] = [];
      if (q.brand) extraConditions.push(Prisma.sql`AND v.brand ILIKE ${`%${q.brand}%`}`);
      if (q.model) extraConditions.push(Prisma.sql`AND v.model ILIKE ${`%${q.model}%`}`);
      if (q.condition) extraConditions.push(Prisma.sql`AND v.condition = ${q.condition}::"VehicleCondition"`);
      if (q.min_price !== undefined) extraConditions.push(Prisma.sql`AND v.price >= ${q.min_price}`);
      if (q.max_price !== undefined) extraConditions.push(Prisma.sql`AND v.price <= ${q.max_price}`);
      if (q.min_km !== undefined) extraConditions.push(Prisma.sql`AND v.mileage_km >= ${q.min_km}`);
      if (q.max_km !== undefined) extraConditions.push(Prisma.sql`AND v.mileage_km <= ${q.max_km}`);
      if (q.year_from !== undefined) extraConditions.push(Prisma.sql`AND v.year_fab >= ${q.year_from}`);
      if (q.year_to !== undefined) extraConditions.push(Prisma.sql`AND v.year_fab <= ${q.year_to}`);
      if (q.fuel) extraConditions.push(Prisma.sql`AND vf.fuel = ${q.fuel}::"Fuel"`);
      if (q.transmission) extraConditions.push(Prisma.sql`AND vf.transmission = ${q.transmission}::"Transmission"`);

      const extraWhere =
        extraConditions.length > 0
          ? Prisma.join(extraConditions, ' ')
          : Prisma.sql``;

      const orderSql =
        q.sort === 'price_asc'
          ? Prisma.sql`v.price ASC`
          : q.sort === 'price_desc'
          ? Prisma.sql`v.price DESC`
          : q.sort === 'newest'
          ? Prisma.sql`v.created_at DESC`
          : Prisma.sql`distance_km ASC`;

      type GeoRow = {
        id: string; user_id: string; brand: string; model: string; version: string | null;
        year_fab: number; year_model: number; mileage_km: number; price: unknown;
        condition: string; status: string; description: string | null; lat: number; lng: number;
        neighborhood: string | null; city: string; state: string; created_at: Date; updated_at: Date;
        distance_km: number | null; cover_image_url: string | null;
      };

      const rows = await prisma.$queryRaw<GeoRow[]>`
        SELECT
          v.*,
          earth_distance(ll_to_earth(v.lat::float8, v.lng::float8), ll_to_earth(${q.lat}::float8, ${q.lng}::float8)) / 1000 AS distance_km,
          (SELECT vi.url FROM vehicle_images vi WHERE vi.vehicle_id = v.id AND vi.is_cover = true LIMIT 1) AS cover_image_url
        FROM vehicles v
        LEFT JOIN vehicle_features vf ON vf.vehicle_id = v.id
        WHERE earth_box(ll_to_earth(${q.lat}::float8, ${q.lng}::float8), ${radiusMeters}::float8) @> ll_to_earth(v.lat::float8, v.lng::float8)
          AND v.status = 'active'
          ${extraWhere}
        ORDER BY ${orderSql}
        LIMIT ${q.limit} OFFSET ${offset}
      `;

      const countRows = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM vehicles v
        LEFT JOIN vehicle_features vf ON vf.vehicle_id = v.id
        WHERE earth_box(ll_to_earth(${q.lat}::float8, ${q.lng}::float8), ${radiusMeters}::float8) @> ll_to_earth(v.lat::float8, v.lng::float8)
          AND v.status = 'active'
          ${extraWhere}
      `;
      const total = Number(countRows[0].count);

      return {
        data: rows.map((r) => ({
          id: r.id,
          brand: r.brand,
          model: r.model,
          version: r.version,
          year_fab: r.year_fab,
          year_model: r.year_model,
          mileage_km: r.mileage_km,
          price: Number(r.price),
          condition: r.condition,
          neighborhood: r.neighborhood,
          city: r.city,
          state: r.state,
          distance_km: r.distance_km !== null ? Math.round(r.distance_km * 10) / 10 : null,
          cover_image_url: r.cover_image_url,
        })),
        meta: { total, page: q.page, limit: q.limit, total_pages: Math.ceil(total / q.limit) },
      };
    }

    // Non-geo query via Prisma ORM
    const where: Prisma.VehicleWhereInput = { status: 'active' };
    if (q.brand) where.brand = { contains: q.brand, mode: 'insensitive' };
    if (q.model) where.model = { contains: q.model, mode: 'insensitive' };
    if (q.condition) where.condition = q.condition;
    if (q.min_price !== undefined || q.max_price !== undefined)
      where.price = { gte: q.min_price, lte: q.max_price };
    if (q.min_km !== undefined || q.max_km !== undefined)
      where.mileage_km = { gte: q.min_km, lte: q.max_km };
    if (q.year_from !== undefined || q.year_to !== undefined)
      where.year_fab = { gte: q.year_from, lte: q.year_to };
    if (q.fuel || q.transmission)
      where.features = {
        ...(q.fuel ? { fuel: q.fuel } : {}),
        ...(q.transmission ? { transmission: q.transmission } : {}),
      };

    const orderByMap: Record<string, Prisma.VehicleOrderByWithRelationInput> = {
      relevance: { created_at: 'desc' },
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      newest: { created_at: 'desc' },
      nearest: { created_at: 'desc' },
    };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: orderByMap[q.sort],
        skip: offset,
        take: q.limit,
        include: { images: { where: { is_cover: true }, take: 1 } },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      data: vehicles.map((v) => ({
        id: v.id,
        brand: v.brand,
        model: v.model,
        version: v.version,
        year_fab: v.year_fab,
        year_model: v.year_model,
        mileage_km: v.mileage_km,
        price: Number(v.price),
        condition: v.condition,
        neighborhood: v.neighborhood,
        city: v.city,
        state: v.state,
        distance_km: null,
        cover_image_url: v.images[0]?.url ?? null,
      })),
      meta: { total, page: q.page, limit: q.limit, total_pages: Math.ceil(total / q.limit) },
    };
  });

  // GET /vehicles/:id
  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        features: true,
        images: { orderBy: [{ is_cover: 'desc' }, { order: 'asc' }] },
        user: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
    return { ...vehicle, price: Number(vehicle.price) };
  });

  // POST /vehicles 🔒
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const schema = z.object({
      brand: z.string(),
      model: z.string(),
      version: z.string().optional(),
      year_fab: z.number().int(),
      year_model: z.number().int(),
      mileage_km: z.number().int().min(0),
      price: z.number().positive(),
      condition: z.enum(['new', 'used', 'certified']),
      description: z.string().optional(),
      lat: z.number(),
      lng: z.number(),
      neighborhood: z.string().optional(),
      city: z.string(),
      state: z.string().length(2),
      features: z
        .object({
          transmission: z.enum(['manual', 'automatic', 'cvt']),
          fuel: z.enum(['flex', 'gasoline', 'diesel', 'electric', 'hybrid']),
          color: z.string(),
          doors: z.number().int(),
          ac: z.boolean().default(false),
          power_steering: z.boolean().default(false),
          abs: z.boolean().default(false),
          airbags: z.number().int().default(0),
        })
        .optional(),
    });
    const body = schema.parse(req.body);
    const vehicle = await prisma.vehicle.create({
      data: {
        user_id: req.user.id,
        brand: body.brand,
        model: body.model,
        version: body.version,
        year_fab: body.year_fab,
        year_model: body.year_model,
        mileage_km: body.mileage_km,
        price: body.price,
        condition: body.condition,
        description: body.description,
        lat: body.lat,
        lng: body.lng,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        features: body.features ? { create: body.features } : undefined,
      },
      include: { features: true },
    });
    return reply.code(201).send({ ...vehicle, price: Number(vehicle.price) });
  });

  // PATCH /vehicles/:id 🔒
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
    if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });

    const schema = z.object({
      brand: z.string().optional(),
      model: z.string().optional(),
      version: z.string().optional(),
      year_fab: z.number().int().optional(),
      year_model: z.number().int().optional(),
      mileage_km: z.number().int().min(0).optional(),
      price: z.number().positive().optional(),
      condition: z.enum(['new', 'used', 'certified']).optional(),
      description: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).optional(),
    });
    const body = schema.parse(req.body);
    const updated = await prisma.vehicle.update({ where: { id }, data: body });
    return { ...updated, price: Number(updated.price) };
  });

  // DELETE /vehicles/:id 🔒
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
    if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });
    await prisma.vehicle.delete({ where: { id } });
    return reply.code(204).send();
  });

  // PATCH /vehicles/:id/status 🔒
  fastify.patch('/:id/status', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
    if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });
    const schema = z.object({ status: z.enum(['active', 'paused', 'sold']) });
    const { status } = schema.parse(req.body);
    const updated = await prisma.vehicle.update({ where: { id }, data: { status } });
    return { ...updated, price: Number(updated.price) };
  });

  // POST /vehicles/:id/images 🔒
  fastify.post('/:id/images', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
    if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });

    const existingCount = await prisma.vehicleImage.count({ where: { vehicle_id: id } });
    if (existingCount >= 15)
      return reply.code(400).send({ error: 'Máximo de 15 imagens atingido' });

    const parts = req.parts();
    const images: { id: string; url: string; order: number; is_cover: boolean }[] = [];
    let orderIndex = existingCount;

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const ext = part.filename?.split('.').pop() ?? 'jpg';
        const key = `vehicles/${id}/${uuidv4()}.${ext}`;
        const url = await uploadFile(buffer, key, part.mimetype);
        const isCover = orderIndex === 0 && existingCount === 0;
        const img = await prisma.vehicleImage.create({
          data: { vehicle_id: id, url, order: orderIndex, is_cover: isCover },
        });
        images.push({ id: img.id, url: img.url, order: img.order, is_cover: img.is_cover });
        orderIndex++;
      }
    }
    return reply.code(201).send({ images });
  });

  // DELETE /vehicles/:id/images/:imgId 🔒
  fastify.delete(
    '/:id/images/:imgId',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { id, imgId } = req.params as { id: string; imgId: string };
      const vehicle = await prisma.vehicle.findUnique({ where: { id } });
      if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
      if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });
      const img = await prisma.vehicleImage.findUnique({ where: { id: imgId } });
      if (!img) return reply.code(404).send({ error: 'Imagem não encontrada' });
      const urlParts = img.url.split('/');
      const key = urlParts.slice(3).join('/');
      try { await deleteFile(key); } catch { /* ignore storage errors */ }
      await prisma.vehicleImage.delete({ where: { id: imgId } });
      return reply.code(204).send();
    },
  );

  // PATCH /vehicles/:id/images/:imgId 🔒
  fastify.patch(
    '/:id/images/:imgId',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { id, imgId } = req.params as { id: string; imgId: string };
      const vehicle = await prisma.vehicle.findUnique({ where: { id } });
      if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });
      if (vehicle.user_id !== req.user.id) return reply.code(403).send({ error: 'Acesso negado' });
      const schema = z.object({
        order: z.number().int().optional(),
        is_cover: z.boolean().optional(),
      });
      const body = schema.parse(req.body);
      if (body.is_cover) {
        await prisma.vehicleImage.updateMany({
          where: { vehicle_id: id },
          data: { is_cover: false },
        });
      }
      const img = await prisma.vehicleImage.update({ where: { id: imgId }, data: body });
      return img;
    },
  );
};

export default vehicleRoutes;
