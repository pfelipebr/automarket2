import { FastifyPluginAsync } from 'fastify';
import prisma from '../db';

const favoriteRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /favorites 🔒
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const favorites = await prisma.favorite.findMany({
      where: { user_id: req.user.id },
      include: {
        vehicle: {
          include: { images: { where: { is_cover: true }, take: 1 } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return favorites.map((f) => ({
      vehicle_id: f.vehicle_id,
      favorited_at: f.created_at,
      vehicle: {
        id: f.vehicle.id,
        brand: f.vehicle.brand,
        model: f.vehicle.model,
        version: f.vehicle.version,
        year_fab: f.vehicle.year_fab,
        year_model: f.vehicle.year_model,
        mileage_km: f.vehicle.mileage_km,
        price: Number(f.vehicle.price),
        condition: f.vehicle.condition,
        city: f.vehicle.city,
        state: f.vehicle.state,
        cover_image_url: f.vehicle.images[0]?.url ?? null,
      },
    }));
  });

  // POST /favorites/:vehicleId 🔒
  fastify.post('/:vehicleId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { vehicleId } = req.params as { vehicleId: string };
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return reply.code(404).send({ error: 'Veículo não encontrado' });

    const existing = await prisma.favorite.findUnique({
      where: { user_id_vehicle_id: { user_id: req.user.id, vehicle_id: vehicleId } },
    });
    if (existing) return reply.code(409).send({ error: 'Já favoritado' });

    const fav = await prisma.favorite.create({
      data: { user_id: req.user.id, vehicle_id: vehicleId },
    });
    return reply.code(201).send(fav);
  });

  // DELETE /favorites/:vehicleId 🔒
  fastify.delete('/:vehicleId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { vehicleId } = req.params as { vehicleId: string };
    await prisma.favorite.deleteMany({
      where: { user_id: req.user.id, vehicle_id: vehicleId },
    });
    return reply.code(204).send();
  });
};

export default favoriteRoutes;
