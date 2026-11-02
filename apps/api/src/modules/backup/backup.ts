import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { logger } from '../../lib/logger';

/**
 * Backup noturno + purga de snapshots expirados (ToS Google: TTL ≤ 30d).
 * O worker roda dentro do processo API; para deploy com cron externo use scripts/backup.sh.
 */

// Executar backup via execSync de pg_dump (mantém retenção via script).
export async function runBackupJob() {
  if (!config.BACKUP_ENABLED) return;
  logger.info('backup job: iniciando');
  const { execFileSync } = await import('child_process');
  try {
    // Backup local (o upload para S3/R2 é feito pelo script/scripts/backup.sh via cron)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = `${config.BACKUP_DIR}/jonisflow-${stamp}.sql.gz`;
    execFileSync('bash', ['-c', `pg_dump "$DATABASE_URL" | gzip > ${file}`], { stdio: 'inherit' });
    logger.info({ file }, 'backup local concluído');
  } catch (e) {
    logger.error({ err: String(e) }, 'backup local FAILED');
    throw e;
  }

  // Purga de snapshots expirados (ToS: nunca manter display data além do TTL)
  const purged = await prisma.leadSnapshot.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  logger.info({ purged: purged.count }, 'snapshots expirados purgados');

  // Retenção de backups locais
  const { execSync } = await import('child_process');
  const dir = config.BACKUP_DIR;
  execSync(`find ${dir} -name 'jonisflow-*.sql.gz' -mtime +${config.BACKUP_RETENTION_DAYS} -delete`);
  logger.info('retenção de backups aplicada');
}

/** Cron interno (node-cron scheduling via setInterval simples — evitando dep extra). */
export function startBackupScheduler() {
  if (!config.BACKUP_ENABLED) return;
  // cron: "0 2 * * *" → 02:00 diariamente
  const [hh, mm] = config.BACKUP_SCHEDULE.split(' ').slice(0, 2).map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    logger.warn('BACKUP_SCHEDULE inválido');
    return;
  }
  const tick = async () => {
    const now = new Date();
    if (now.getHours() === hh && now.getMinutes() === mm) {
      try { await runBackupJob(); }
      catch (e) { logger.error({ err: String(e) }, 'backup job erro'); }
    }
  };
  setInterval(tick, 60_000); // checa a cada minuto (cheap)
  logger.info({ schedule: config.BACKUP_SCHEDULE }, 'backup scheduler iniciado');
}
