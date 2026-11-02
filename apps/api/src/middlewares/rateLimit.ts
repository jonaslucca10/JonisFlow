import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Rate limiting: brute force em /auth e abuso/custo da Google API em /search.
// Em multi-instância, trocar o store por Redis (rate-limit-redis) — memória
// local é suficiente para MVP single-instance.

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.RATE_LIMIT_AUTH_PER_15MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde.' } },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_SEARCH_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Muitas buscas por minuto.' } },
});
