import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { setAuthCookies, clearAuthCookies } from '../../lib/cookies';
import { requireAuth, type AuthedRequest } from '../../middlewares/auth';
import { HttpError } from '../../middlewares/error';
import { RegisterSchema, LoginSchema, ResetSchema, register, login, refreshSession, logout, forgotPassword, resetPassword, me } from './auth.service';

const router = Router();

function readCookie(req: { headers: { cookie?: string } }, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

router.post('/register', async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await register(data);
    // Cookies httpOnly + SameSite (segurança; tokens não acessíveis via JS)
    setAuthCookies(res, result.access, result.refresh);
    res.status(201).json({ user: result.user });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const result = await login(data);
    setAuthCookies(res, result.access, result.refresh);
    res.json({ user: result.user });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refresh = readCookie(req, 'jf_refresh');
    if (!refresh) throw new HttpError(401, 'NO_REFRESH', 'Refresh token ausente');
    const result = await refreshSession(refresh);
    setAuthCookies(res, result.access, result.refresh);
    res.json({ user: result.user });
  } catch (e) { next(e); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refresh = readCookie(req, 'jf_refresh');
    await logout(refresh);
    clearAuthCookies(res);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Sempre 202 — não revela se o e-mail existe (evitação de enumeração).
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email().toLowerCase() }).parse(req.body);
    await forgotPassword(email);
    res.status(202).json({ message: 'Se o e-mail existir, enviamos um link de redefinição.' });
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const data = ResetSchema.parse(req.body);
    await resetPassword(data);
    res.json({ message: 'Senha redefinida. Faça login.' });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await me(req.user!.id));
  } catch (e) { next(e); }
});

export default router;
