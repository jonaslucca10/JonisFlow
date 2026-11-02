import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { HttpError } from '../../middlewares/error';
import { logger } from '../../lib/logger';
import { dispatchMail } from '../mail/mail.service';

/**
 * Billing — Stripe (Checkout hospedado + Webhook).
 *  - Idempotência: UNIQUE(gateway, event_id) em webhook_events → redelivery ignorado.
 *  - Assinatura do webhook: timing-safe (constructEvent) — rejeita spoofing.
 *  - Mercado Pago: alternativa documentada (webhook assinado via headers), não implementada.
 */

const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;

export const CheckoutSchema = z.object({
  gateway: z.enum(['stripe', 'mercadopago']).optional(), // default: DEFAULT_GATEWAY
  priceId: z.string().optional(), // default: STRIPE_PRICE_ID (plano mensal)
});

export async function createCheckout(userId: string, email: string, gateway: 'stripe' | 'mercadopago', priceId?: string) {
  if (gateway === 'mercadopago') {
    const { createMercadoPagoCheckout } = await import('./mercadopago.service');
    return createMercadoPagoCheckout(userId, email);
  }
  return createCheckoutSession(userId, email, priceId);
}

export async function createCheckoutSession(userId: string, email: string, priceId?: string) {
  if (!stripe) throw new HttpError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe não configurado');
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId || config.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: config.STRIPE_SUCCESS_URL,
    cancel_url: config.STRIPE_CANCEL_URL,
    // user_id no metadata → webhook sabe a quem ativar (sem confiar em corpo de cliente)
    metadata: { userId, email },
    subscription_data: { metadata: { userId } },
  });
  return { url: session.url };
}

export async function getSubscription(userId: string) {
  const subs = await prisma.subscription.findMany({ where: { userId } });
  return subs.find((s) => s.status === 'active' || s.status === 'past_due') ?? null;
}

export async function cancelAtPeriodEnd(userId: string) {
  const sub = await getSubscription(userId);
  if (!sub) throw new HttpError(404, 'NO_SUBSCRIPTION', 'Nenhuma assinatura ativa');
  if (!stripe) throw new HttpError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe não configurado');
  await stripe.subscriptions.update(sub.gatewaySubscriptionId, { cancel_at_period_end: true });
  await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  return { ok: true };
}

/**
 * Webhook: verificação de assinatura + idempotência + processamento.
 * Requer o body RAW (não parseado) — o Stripe assina o bytes exatos.
 */
export async function handleWebhook(rawBody: Buffer, signature: string) {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe webhook não configurado');

  // ① Verificação de assinatura (timing-safe) — rejeita spoofing
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err: String(err) }, 'webhook assinatura inválida');
    throw new HttpError(400, 'INVALID_SIGNATURE', 'Assinatura do webhook inválida');
  }

  // ② Idempotência: tenta inserir o evento; UNIQUE(gateway, event_id) protege contra redelivery.
  try {
    await prisma.webhookEvent.create({
      data: {
        gateway: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payloadJson: event.data.object as any,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Evento já visto: se ainda não processado (processedAt null = falha anterior),
      // permite reprocessamento como retry. Caso contrário, acena e ignora.
      const existing = await prisma.webhookEvent.findUnique({ where: { gateway_eventId: { gateway: 'stripe', eventId: event.id } } });
      if (existing?.processedAt) return { received: true, duplicate: true };
      logger.info({ eventId: event.id }, 'webhook reprocessado (retry)');
    } else {
      throw err;
    }
  }

  // ③ Processamento (por tipo) — erros não marcam processedAt → redelivery reprocessa
  await processEvent(event);
  await prisma.webhookEvent.update({
    where: { gateway_eventId: { gateway: 'stripe', eventId: event.id } },
    data: { processedAt: new Date() },
  });
  return { received: true };
}

async function processEvent(event: Stripe.Event) {
  const obj = event.data.object as any;
  const userId = obj?.metadata?.userId ?? obj?.subscription_data?.metadata?.userId ?? null;

  switch (event.type) {
    case 'checkout.session.completed': {
      // Ativa assinatura: fetch dos dados reais no Stripe (não confia no payload)
      const session = await stripe!.checkout.sessions.retrieve(obj.id);
      const sub = await stripe!.subscriptions.retrieve(session.subscription as string);
      const customer = await stripe!.customers.retrieve(session.customer as string);
      if (!userId) throw new Error('missing userId');
      await prisma.subscription.upsert({
        where: { gatewaySubscriptionId: sub.id },
        create: {
          userId,
          gateway: 'stripe',
          gatewayCustomerId: customer.id,
          gatewaySubscriptionId: sub.id,
          status: sub.status,
          plan: sub.items.data[0]?.price?.nickname ?? 'monthly',
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          status: sub.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      logger.info({ userId, sub: sub.id }, 'assinatura ativada');
      break;
    }
    case 'invoice.paid': {
      if (userId) {
        await prisma.payment.create({
          data: {
            subscriptionId: null, // link depois via subscription_id do invoice
            gateway: 'stripe',
            gatewayPaymentId: obj.payment_intent,
            amount: Math.round(obj.amount_paid / 100), // Stripe usa centavos
            currency: obj.currency,
            status: 'paid',
            paidAt: new Date(obj.created * 1000),
            rawPayloadJson: obj as any,
          },
        }).catch(() => { /* duplicata de invoice (renovação) — idempotente pelo gateway id */ });
        dispatchMail('billing_confirmed', { email: await getUserEmail(userId), name: await getUserName(userId), amount: (obj.amount_paid / 100).toFixed(2), currency: obj.currency.toUpperCase() }).catch(() => {});
      }
      break;
    }
    case 'invoice.payment_failed': {
      if (userId) {
        await prisma.subscription.updateMany({ where: { userId, status: 'active' }, data: { status: 'past_due' } });
        dispatchMail('billing_failed', { email: await getUserEmail(userId), name: await getUserName(userId) }).catch(() => {});
      }
      break;
    }
    case 'customer.subscription.deleted': {
      if (userId) {
        await prisma.subscription.updateMany({ where: { userId, gatewaySubscriptionId: obj.id }, data: { status: 'canceled' } });
      }
      break;
    }
    default:
      logger.debug({ type: event.type }, 'evento de webhook ignorado');
  }
}

async function getUserEmail(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? '';
}
async function getUserName(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? '';
}

/** Painel de uso: contagens do usuário vs limites do plano (MVP: plano grátis 3 buscas / 5 exportações). */
export async function getUsage(userId: string) {
  const since = new Date(Date.now() - 30 * 86400000); // rolling 30d
  const [searchesUsed, exportsUsed] = await Promise.all([
    prisma.search.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.export.count({ where: { userId, createdAt: { gte: since } } }),
  ]);
  return { searchesUsed, searchesLimit: 3, exportsUsed, exportsLimit: 5 };
}
