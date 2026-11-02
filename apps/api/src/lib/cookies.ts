import type { Response } from 'express';
import { config, isProd } from '../config';

// Cookies httpOnly: tokens NUNCA são legíveis por JS (XSS não rouba).
// Secure em prod (HTTPS obrigatório); SameSite=Lax mitiga CSRF.
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookie('jf_access', accessToken, { ...base, maxAge: 15 * 60 * 1000 }); // 15m
  res.cookie('jf_refresh', refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30d
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('jf_access', { path: '/' });
  res.clearCookie('jf_refresh', { path: '/' });
}
