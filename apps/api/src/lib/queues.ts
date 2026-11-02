import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

// Fila única do Redis para e-mails transacionais. Em multi-instância, o worker
// roda em cada replica (concurrency pequena) — webhook processado síncrono
// mas idempotente, não precisa de fila.
let connection: IORedis | undefined;

export function getRedis(): IORedis {
  if (!connection) {
    // Lazy: não conecta logo no import (evitar spam de erro quando Redis ausente;
    // a fila de e-mails cai no envio síncrono em dispatchMail).
    connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
    connection.on('error', () => {}); // silencioso: fallback síncrono
  }
  return connection;
}

export async function isRedisAvailable(): Promise<boolean> {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}

export const mailQueue = new Queue('mail', { connection: getRedis() });
