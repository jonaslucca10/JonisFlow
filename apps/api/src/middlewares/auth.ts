import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';

// Extendo Request com o usuário autenticado — o handler NUNCA confia em
// dados do body/query para identificar o tenant. user_id vem só do token.
export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookie = req.headers.cookie || '';

  // Caso 1: Authorization: Bearer <access token> (uso API/scripts)
  let token: string | undefined;
  if (header?.startsWith('Bearer ')) token = header.slice(7);
  // Caso 2: cookie httpOnly (frontend navegador)
  if (!token) {
    const m = cookie.match(/(?:^|;\s*)jf_access=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }

  if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' } });

  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as { sub: string; email: string };
    // User ainda existe? (revogação imediata se conta removida)
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true } });
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Usuário inexistente' } });
    req.user = { id: user.id, email: user.email };
    next();
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token inválido ou expirado' } });
  }
}
