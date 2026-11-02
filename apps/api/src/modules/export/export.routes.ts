import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../../middlewares/auth';
import { ExportSchema, createExport, getExport, downloadExport } from './export.service';

const router = Router();

router.post('/exports', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = ExportSchema.parse(req.body);
    // CSV transiente: retorna os dados já prontos para download imediato.
    // O conteúdo do Google não é persistido — minimização (ToS/LGPD).
    res.status(201).json(await createExport(req.user!.id, data));
  } catch (e) { next(e); }
});

router.get('/exports/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const record = await getExport(req.user!.id, req.params.id);
    res.json({ id: record.id, format: record.format, rowsCount: record.rowsCount, createdAt: record.createdAt });
  } catch (e) { next(e); }
});

router.get('/exports/:id/download', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { filename, csv } = await downloadExport(req.user!.id, req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM: Excel BR lê UTF-8 corretamente
  } catch (e) { next(e); }
});

export default router;
