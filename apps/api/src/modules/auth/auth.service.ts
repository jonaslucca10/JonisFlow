import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { HttpError } from '../../middlewares/error';
import { sendMail } from '../mail/mail.service';

const SALT_ROUNDS = 10; // bcrypt cost 10 — produção: 12+ se hardware permitir

export const RegisterSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'min 8 caracteres').max(128),
  name: z.string().min(2).max(80),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const ResetSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, 'min 8 caracteres').max(128),
});

function signAccessToken(userId: string, email: string) {
  // jsonwebtoken v9 tipa expiresIn como ms.StringValue — conversão segura
  const options: jwt.SignOptions = { expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId, email }, config.JWT_ACCESS_SECRET, options);
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars
}

export async function register(input: z.infer<typeof RegisterSchema>) {
  const { email, password, name } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'EMAIL_IN_USE', 'E-mail já cadastrado');

  // Hash de senha com bcrypt (não reversível). Nunca armazenar senha plana.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  });

  // Cookies + e-mail de boas-vindas
  const access = signAccessToken(user.id, user.email);
  const refresh = randomToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d
    },
  });
  void sendMail('welcome', { email: user.email, name: user.name });
  return { user, access, refresh };
}

export async function login(input: z.infer<typeof LoginSchema>) {
  const { email, password } = input;
  const user = await prisma.user.findUnique({ where: { email } });
  // Mesmo erro para e-mail inexistente e senha errada (sem leak)
  if (!user) throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');

  const access = signAccessToken(user.id, user.email);
  const refresh = randomToken();
  await prisma.session.create({
    data: { userId: user.id, refreshTokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return { user: { id: user.id, email: user.email, name: user.name }, access, refresh };
}

export async function refreshSession(refreshToken: string) {
  const hash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token inválido');
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, name: true } });
  if (!user) throw new HttpError(401, 'INVALID_REFRESH', 'Refresh token inválido');

  // Rotatividade: revoga o antigo, cria novo (replay de refresh token é detectável)
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const access = signAccessToken(user.id, user.email);
  const refresh = randomToken();
  await prisma.session.create({
    data: { userId: user.id, refreshTokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return { user, access, refresh };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    await prisma.session.updateMany({ where: { refreshTokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

export async function forgotPassword(email: string) {
  // Sempre 202: não leaka se o e-mail existe (evita enumeração).
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = randomToken();
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1h
  });
  const link = `${config.MAIL_RESET_URL_BASE}?token=${token}`;
  await sendMail('password_reset', { email: user.email, name: user.name, link });
}

export async function resetPassword(input: z.infer<typeof ResetSchema>) {
  const { token, password } = input;
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, 'RESET_INVALID', 'Token inválido, usado ou expirado');
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }), // single-use
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
  ]);
  // Revoga sessões ativas após redefinição
  await prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true, subscriptions: true },
  });
  const subscription = user?.subscriptions.find((s) => s.status === 'active' || s.status === 'past_due');
  return { id: user?.id, email: user?.email, name: user?.name, subscription: subscription ?? null };
}
