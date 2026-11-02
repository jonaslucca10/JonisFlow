import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config, isProd } from './config';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './middlewares/error';
import { authLimiter } from './middlewares/rateLimit';
import authRoutes from './modules/auth/auth.routes';
import searchRoutes from './modules/search/search.routes';
import leadRoutes from './modules/leads/leads.routes';
import exportRoutes from './modules/export/export.routes';
import billingRoutes from './modules/billing/billing.routes';
import { startBackupScheduler } from './modules/backup/backup';

async function main() {
  const app = express();

  // Body parser ANTES das rotas (o webhook usa raw em rota específica)
  app.use(express.json());

  // Security headers + CORS restrito (produção: só domínio próprio)
  app.use(helmet({
    contentSecurityPolicy: isProd ? { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] } } : undefined,
  }));
  app.use(cors({ origin: isProd ? [new URL(config.WEB_URL).origin] : true, credentials: true }));
  app.use(pinoHttp({ logger }));

  // Rotas públicas (sem auth): health está em billing routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api', searchRoutes);
  app.use('/api', leadRoutes);
  app.use('/api', exportRoutes);
  app.use('/api', billingRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info({ port: config.PORT }, 'API JonisFlow iniciada');
    if (isProd) startBackupScheduler(); // backup noturno interno em prod
  });

  // Worker da fila de e-mails (BullMQ) — só se Redis disponível
  try {
    const { Worker } = await import('bullmq');
    const { getRedis, isRedisAvailable } = await import('./lib/queues');
    const { sendMail } = await import('./modules/mail/mail.service');
    if (await isRedisAvailable()) {
      new Worker('mail', async (job) => { await sendMail(job.data.kind, job.data.data); }, { connection: getRedis(), concurrency: 5 });
      logger.info('worker de e-mails iniciado');
    } else {
      logger.warn('Redis indisponível — e-mails no fallback síncrono');
    }
  } catch (e) {
    logger.warn({ err: String(e) }, 'fila de e-mails não iniciada (fallback síncrono)');
  }

  // Graceful shutdown
  const shutdown = async () => {
    server.close(); await prisma.$disconnect(); process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { logger.error({ err: String(e) }, 'falha ao iniciar API'); process.exit(1); });
