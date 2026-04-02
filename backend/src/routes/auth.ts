import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import prisma from '../db';
import { config } from '../config';

const BCRYPT_ROUNDS = 10;

function refreshExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

function issueAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, config.jwtSecret, {
    expiresIn: config.jwtExpiry as jwt.SignOptions['expiresIn'],
  });
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token,
      expires_at: refreshExpiryDate(),
    },
  });
  return token;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/register
  fastify.post('/register', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.code(409).send({ error: 'Email já cadastrado' });

    const password_hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, password_hash, phone: body.phone },
      select: { id: true, name: true, email: true, phone: true },
    });

    const access_token = issueAccessToken(user.id, user.email);
    const refresh_token = await issueRefreshToken(user.id);

    reply.setCookie('refresh_token', refresh_token, {
      httpOnly: true,
      path: '/auth/refresh',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
    return reply.code(201).send({ user, access_token });
  });

  // POST /auth/login
  fastify.post('/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    });
    const body = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.code(401).send({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) return reply.code(401).send({ error: 'Credenciais inválidas' });

    const access_token = issueAccessToken(user.id, user.email);
    const refresh_token = await issueRefreshToken(user.id);

    reply.setCookie('refresh_token', refresh_token, {
      httpOnly: true,
      path: '/auth/refresh',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
    return {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      access_token,
    };
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const token = req.cookies.refresh_token;
    if (!token) return reply.code(401).send({ error: 'Refresh token ausente' });

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expires_at < new Date()) {
      return reply.code(401).send({ error: 'Refresh token inválido ou expirado' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.user_id } });
    if (!user) return reply.code(401).send({ error: 'Usuário não encontrado' });

    const access_token = issueAccessToken(user.id, user.email);
    return { access_token };
  });

  // POST /auth/logout
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const token = req.cookies.refresh_token;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    reply.clearCookie('refresh_token', { path: '/auth/refresh' });
    return { message: 'Logout realizado com sucesso' };
  });

  // POST /auth/forgot-password
  fastify.post('/forgot-password', async (req, reply) => {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // In production: send reset email. For now, log the token.
      const resetToken = uuidv4();
      console.log(`[forgot-password] reset token for ${email}: ${resetToken}`);
    }
    // Always return 200 to avoid user enumeration
    return { message: 'Se o email existir, você receberá as instruções em breve.' };
  });

  // POST /auth/reset-password
  fastify.post('/reset-password', async (req, reply) => {
    const schema = z.object({ token: z.string(), password: z.string().min(6) });
    const { password } = schema.parse(req.body);
    // In production: look up token in DB, validate, update password.
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    console.log('[reset-password] would update password hash:', password_hash);
    return { message: 'Senha redefinida com sucesso.' };
  });
};

export default authRoutes;
