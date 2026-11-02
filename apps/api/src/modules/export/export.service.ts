import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middlewares/error';

/**
 * Exportação CSV:
 *  - Gera o arquivo no momento do pedido (transient) — NUNCA persiste dados do
 *    Google em disco/storage (minimização ToS/LGPD).
 *  - Metadados (contagem, formato, data) ficam em `exports`.
 *  - Multi-tenant: só leads do usuário autenticado.
 */

export const ExportSchema = z.object({
  searchId: z.string().uuid().optional(),
  format: z.enum(['csv']).default('csv'),
});

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`; // RFC 4180
  return s;
}

function buildCsv(rows: Record<string, unknown>[]): string {
  const header = ['id', 'place_id', 'name', 'address', 'phone', 'website_present', 'phone_present', 'rating', 'user_ratings', 'ai_score', 'ai_reason', 'suggested_pitch', 'created_at'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

/** Ler leads + snapshots vigentes do usuário (multi-tenant: userId obrigatório). */
async function buildRowsForUser(userId: string, searchId?: string): Promise<Record<string, unknown>[]> {
  const leads = await prisma.lead.findMany({
    where: { userId, ...(searchId ? { searchId } : {}) },
    orderBy: { aiScore: 'desc' }, // prioridade da IA no CSV
  });
  const snapshots = await prisma.leadSnapshot.findMany({
    where: { placeId: { in: leads.map((l) => l.placeId) }, expiresAt: { gt: new Date() } },
  });
  // Tipo explícito no boundary de dados (robustez independente do stub/cliente)
  const byPlace = new Map(snapshots.map((s) => [s.placeId, { name: s.name, address: s.address, phone: s.phone }]));

  return leads.map((l) => {
    const s = byPlace.get(l.placeId);
    return {
      id: l.id,
      place_id: l.placeId,
      name: s?.name ?? '',
      address: s?.address ?? '',
      phone: s?.phone ?? '',
      website_present: l.websitePresent,
      phone_present: l.phonePresent,
      rating: l.rating,
      user_ratings: l.userRatings,
      ai_score: l.aiScore,
      ai_reason: l.aiReason,
      suggested_pitch: l.suggestedPitch,
      created_at: l.createdAt.toISOString(),
    };
  });
}

export async function createExport(userId: string, input: z.infer<typeof ExportSchema>) {
  const rows = await buildRowsForUser(userId, input.searchId ?? undefined);
  const record = await prisma.export.create({
    data: { userId, searchId: input.searchId ?? null, format: input.format, rowsCount: rows.length },
  });
  return { id: record.id, format: input.format, rowsCount: rows.length, csv: buildCsv(rows), createdAt: record.createdAt };
}

export async function getExport(userId: string, id: string) {
  const record = await prisma.export.findFirst({ where: { id, userId } }); // multi-tenant
  if (!record) throw new HttpError(404, 'EXPORT_NOT_FOUND', 'Exportação não encontrada');
  return record;
}

/** Rebuild determinístico do CSV (idempotente; sem persistir conteúdo do Google). */
export async function downloadExport(userId: string, id: string): Promise<{ filename: string; csv: string }> {
  const record = await getExport(userId, id);
  const rows = await buildRowsForUser(userId, record.searchId ?? undefined);
  return { filename: `jonisflow-export-${record.id.slice(0, 8)}.csv`, csv: buildCsv(rows) };
}
