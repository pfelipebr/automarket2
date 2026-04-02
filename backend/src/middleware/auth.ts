import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JwtPayload {
  sub: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        req.user = { id: payload.sub, email: payload.email };
      } catch {
        return reply.code(401).send({ error: 'Token inválido ou expirado' });
      }
    },
  );
};

// fastify-plugin needed so the decorator is available on the root instance
// We export a plain plugin and wrap it with fp at registration time
export default fp(authPlugin, { name: 'auth' });
