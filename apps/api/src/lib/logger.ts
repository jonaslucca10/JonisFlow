import pino from 'pino';

// Logs estruturados: JSON em prod, legível em dev. Nenhum secret é logado
// (pino-http redact em deps do index).
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'jonisflow-api' },
  redact: ['*.password', '*.passwordHash', '*.token', '*.refreshToken', '*.apiKey', '*.api_key', '*.secret', '*.authorization'],
});
