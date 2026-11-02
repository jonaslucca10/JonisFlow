import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, type AuthedRequest } from '../../middlewares/auth';
import { listLeads, getLeadDetail, enrichLeadDisplay } from '../search/search.service';
import { HttpError } from '../../middlewares/error';

const router = Router();

router.get('/leads', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const q = z.object({
      searchId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      minScore: z.coerce.number().int().min(0).max(100).optional(),
      temTelefone: z.string().transform((v) => v === 'true' || v === '1').optional(),
    }).parse(req.query);
    res.json(await listLeads(req.user!.id, q));
  } catch (e) { next(e); }
});

router.get('/leads/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getLeadDetail(req.user!.id, req.params.id));
  } catch (e) { next(e); }
});

// Detalhe enriquecido: snapshot expirado → re-fetch transient do Google (ToS: TTL)
router.get('/leads/:id/display', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await enrichLeadDisplay(req.user!.id, req.params.id));
  } catch (e) { next(e); }
});

router.delete('/leads/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!lead) throw new HttpError(404, 'LEAD_NOT_FOUND', 'Lead não encontrado');
    await prisma.lead.delete({ where: { id: lead.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Histórico de buscas (multi-tenant: só do usuário autenticado)
router.get('/searches', requireAuth, async (req: AuthedRequest, res) => {
  const searches = await prisma.search.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ items: searches });
});

export default router;
