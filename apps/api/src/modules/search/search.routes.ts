import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../../middlewares/auth';
import { searchLimiter } from '../../middlewares/rateLimit';
import { SearchSchema, runSearch } from './search.service';

const router = Router();

// Busca: rate-limited (custo da Google API + abuso). Requer auth.
router.post('/search', requireAuth, searchLimiter, async (req: AuthedRequest, res, next) => {
  try {
    const data = SearchSchema.parse(req.body);
    const result = await runSearch(req.user!.id, data);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

export default router;
