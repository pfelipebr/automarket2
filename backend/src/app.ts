import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import { ZodError } from 'zod';

import { config } from './config';
import authPlugin from './middleware/auth';
import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicles';
import favoriteRoutes from './routes/favorites';
import meRoutes from './routes/me';
import adminRoutes from './routes/admin';
import { isFailureActive, failureState } from './failureState';
import prisma from './db';

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      if (!body || (body as string).trim() === '') {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'Dados inválidos', details: error.issues });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'Erro interno do servidor' });
  });

  await app.register(fastifyCors, {
    origin: config.corsOrigin,
    credentials: true,
  });
  await app.register(fastifyCookie);
  await app.register(fastifyFormbody);
  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  await app.register(authPlugin);

  // Failure simulation: return 503 on all non-admin/health routes when active
  app.addHook('preHandler', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (path.startsWith('/admin') || path === '/health' || path === '/ready') return;
    if (isFailureActive()) {
      return reply.code(503).send({
        error: 'Service Unavailable',
        reason: failureState.reason || 'Simulated failure',
      });
    }
  });

  app.get('/health', async () => ({ status: 'ok', service: 'automarket-backend' }));
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not ready', reason: 'db unavailable' });
    }
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(vehicleRoutes, { prefix: '/vehicles' });
  await app.register(favoriteRoutes, { prefix: '/favorites' });
  await app.register(meRoutes, { prefix: '/me' });
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
