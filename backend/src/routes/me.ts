import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import prisma from '../db';

const meRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me 🔒
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, created_at: true },
    });
    return user;
  });

  // PATCH /me 🔒
  fastify.patch('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: body,
      select: { id: true, name: true, email: true, phone: true },
    });
    return user;
  });

  // GET /me/vehicles 🔒
  fastify.get('/vehicles', { preHandler: [fastify.authenticate] }, async (req) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { user_id: req.user.id },
      include: { images: { where: { is_cover: true }, take: 1 } },
      orderBy: { created_at: 'desc' },
    });
    return vehicles.map((v) => ({
      id: v.id,
      brand: v.brand,
      model: v.model,
      version: v.version,
      year_fab: v.year_fab,
      year_model: v.year_model,
      mileage_km: v.mileage_km,
      price: Number(v.price),
      condition: v.condition,
      status: v.status,
      city: v.city,
      state: v.state,
      created_at: v.created_at,
      cover_image_url: v.images[0]?.url ?? null,
    }));
  });
};

export default meRoutes;
