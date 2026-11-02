import { Router, raw, text } from 'express';
import { requireAuth, type AuthedRequest } from '../../middlewares/auth';
import { config } from '../../config';
import { CheckoutSchema, createCheckout, getSubscription, cancelAtPeriodEnd, handleWebhook, getUsage } from './billing.service';
import { cancelMercadoPagoSubscription, handleMercadoPagoWebhook } from './mercadopago.service';

const router = Router();

// Checkout hospedado (Stripe ou Mercado Pago) — chaves só server-side, never no frontend.
router.post('/billing/checkout', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = CheckoutSchema.parse(req.body ?? {});
    const gateway = data.gateway ?? config.DEFAULT_GATEWAY;
    res.json(await createCheckout(req.user!.id, req.user!.email, gateway, data.priceId));
  } catch (e) { next(e); }
});

router.get('/billing/subscription', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getSubscription(req.user!.id));
  } catch (e) { next(e); }
});

router.post('/billing/cancel', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    // Cancelamento por gateway da assinatura ativa
    const sub = await getSubscription(req.user!.id);
    const result = sub?.gateway === 'mercadopago'
      ? await cancelMercadoPagoSubscription(req.user!.id)
      : await cancelAtPeriodEnd(req.user!.id);
    res.json(result);
  } catch (e) { next(e); }
});

// ⚠️ Webhook Stripe: body RAW (express.raw) — assina os bytes exatos;
// não use express.json() nesta rota.
router.post(
  '/billing/webhook',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    try {
      const result = await handleWebhook(req.body as Buffer, sig);
      res.json(result);
    } catch (e: any) {
      res.status(e.status || 500).json({ error: { code: e.code || 'WEBHOOK_ERROR', message: e.message } });
    }
  },
);

// Webhook Mercado Pago: assinatura HMAC-SHA256 (x-signature vs secret).
router.post('/billing/mercadopago/webhook', text({ type: 'application/json' }), async (req, res) => {
  try {
    res.json(await handleMercadoPagoWebhook(req.body as string, req.headers['x-signature'] as string));
  } catch (e: any) {
    res.status(e.status || 500).json({ error: { code: e.code || 'WEBHOOK_ERROR', message: e.message } });
  }
});

// Healthcheck público (UptimeRobot / Better Stack apontam aqui)
router.get('/health', async (_req, res) => {
  res.json({ status: 'ok', service: config.APP_NAME, uptime: Math.round(process.uptime()) });
});

router.get('/usage', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getUsage(req.user!.id));
  } catch (e) { next(e); }
});

export default router;
