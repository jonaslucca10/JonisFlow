import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { HttpError } from '../../middlewares/error';
import { logger } from '../../lib/logger';
import { dispatchMail } from '../mail/mail.service';

/**
 * Mercado Pago (gateway alternativo / opção BR).
 *
 * Fluxo: preapproval (assinatura recorrente) → checkout hospedado do MP
 * (usuário autoriza o cartão) → webhook (preapproval_approved,
 * suscription_auto_renew, suscription_canceled...) → assinatura ativa.
 *
 * Segurança: webhook verificado por assinatura HMAC-SHA256 (x-signature vs
 * MERCADOPAGO_WEBHOOK_SECRET) — igual ao helper oficial do SDK; idempotência
 * via UNIQUE(gateway, event_id) em webhook_events.
 */

async function mpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${config.MERCADOPAGO_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as any; // Node 22 tipa json() como unknown
  if (!res.ok) {
    throw new HttpError(502, 'MERCADO_PAGO_API_ERROR', data.message || 'Erro no Mercado Pago', data);
  }
  return data;
}

/** Criar preapproval e retornar a URL de checkout hospedado do MP. */
export async function createMercadoPagoCheckout(userId: string, _email: string) {
  if (!config.MERCADOPAGO_ACCESS_TOKEN) {
    throw new HttpError(503, 'MP_NOT_CONFIGURED', 'Mercado Pago não configurado');
  }
  const preapproval = await mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Assinatura mensal JonisFlow',
      description: 'Assinatura mensal do JonisFlow (recorrência)',
      short_description: 'JonisFlow mensal',
      price: config.MERCADOPAGO_PRICE, // centavos
      currency_id: config.MERCADOPAGO_CURRENCY,
      cycle: 'monthly',
      frequency: 1,
      automatic_taxing: false,
      // back_urls: o usuário retorna ao app após autorizar/cancelar
      back_urls: {
        success: config.STRIPE_SUCCESS_URL,
        pending: config.STRIPE_CANCEL_URL,
        failure: config.STRIPE_CANCEL_URL,
      },
      // user_id no external_reference → webhook sabe a quem ativar
      external_reference: userId,
    }),
  });
  return {
    url: `${config.MERCADOPAGO_MP_CHECKOUT_BASE}?preapproval_id=${preapproval.id}`,
    gateway: 'mercadopago',
  };
}

export async function cancelMercadoPagoSubscription(userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { userId, gateway: 'mercadopago' } });
  if (!sub) throw new HttpError(404, 'NO_SUBSCRIPTION', 'Nenhuma assinatura Mercado Pago ativa');
  await mpFetch(`/preapproval/${sub.gatewaySubscriptionId}`, { method: 'DELETE' });
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'canceled' } });
  logger.info({ userId, preapproval: sub.gatewaySubscriptionId }, 'assinatura MP cancelada');
  return { ok: true };
}

/** Verificação de assinatura do webhook (HMAC-SHA256 raw body vs x-signature). */
export function verifyMercadoPagoSignature(rawBody: string, xSignature: string) {
  const secret = config.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'MP_NOT_CONFIGURED', 'MERCADOPAGO_WEBHOOK_SECRET ausente');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(xSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(400, 'INVALID_SIGNATURE', 'Assinatura do webhook inválida');
  }
}

/**
 * Webhook do MP: assinatura verificada → idempotência → processamento.
 * Eventos do MP: preapproval_created | preapproval_approved | preapproval_canceled
 * | suscription_auto_renew | suscription_charged | suscription_updated | suscription_canceled
 */
export async function handleMercadoPagoWebhook(rawBody: string, xSignature: string) {
  verifyMercadoPagoSignature(rawBody, xSignature); // ① rejeita spoofing

  const payload = JSON.parse(rawBody);
  const eventId = payload.event_id ?? payload.id ?? `${payload.action}-${payload.data?.id}`;
  const topic = payload.topic ?? payload.action ?? 'unknown';

  // ② Idempotência: UNIQUE(gateway, event_id)
  try {
    await prisma.webhookEvent.create({
      data: { gateway: 'mercadopago', eventId, eventType: topic, payloadJson: payload as any },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const existing = await prisma.webhookEvent.findUnique({
        where: { gateway_eventId: { gateway: 'mercadopago', eventId } },
      });
      if (existing?.processedAt) return { received: true, duplicate: true }; // redelivery ignorado
      logger.info({ eventId }, 'webhook MP reprocessado (retry)');
    } else {
      throw err;
    }
  }

  // ③ Processamento; erros não marcam processedAt → redelivery reprocessa
  await processMercadoPagoEvent(payload, topic);
  await prisma.webhookEvent.update({
    where: { gateway_eventId: { gateway: 'mercadopago', eventId } },
    data: { processedAt: new Date() },
  });
  return { received: true };
}

async function processMercadoPagoEvent(payload: any, topic: string) {
  const data = payload.data ?? payload;
  const preapprovalId: string = data.preapproval_id ?? data.id ?? null;

  switch (topic) {
    case 'preapproval_approved': {
      if (!preapprovalId) break;
      const pre = await mpFetch(`/preapproval/${preapprovalId}`); // dados reais, não confiar no payload
      const userId = pre.external_reference ?? null;
      if (!userId) throw new Error('preapproval sem external_reference');
      await prisma.subscription.upsert({
        where: { gatewaySubscriptionId: preapprovalId },
        create: {
          userId,
          gateway: 'mercadopago',
          gatewayCustomerId: pre.payer?.id ?? 'mp:payer',
          gatewaySubscriptionId: preapprovalId,
          status: pre.auto_renew ? 'active' : 'inactive',
          plan: 'monthly',
          currentPeriodStart: pre.start_date ? new Date(pre.start_date) : null,
          currentPeriodEnd: pre.next_payment_date ? new Date(pre.next_payment_date) : null,
          cancelAtPeriodEnd: false,
        },
        update: {
          status: pre.auto_renew ? 'active' : 'inactive',
          currentPeriodStart: pre.start_date ? new Date(pre.start_date) : null,
          currentPeriodEnd: pre.next_payment_date ? new Date(pre.next_payment_date) : null,
        },
      });
      logger.info({ userId, preapprovalId }, 'assinatura MP ativada');
      break;
    }
    case 'suscription_auto_renew': {
      // Renovação mensal bem-sucedida: registrar pagamento + novo período
      const pre = preapprovalId ? await mpFetch(`/preapproval/${preapprovalId}`) : null;
      const userId = pre?.external_reference ?? null;
      if (userId) {
        await prisma.payment.create({
          data: {
            gateway: 'mercadopago',
            gatewayPaymentId: String(data.id ?? payload.id ?? `${preapprovalId}-${Date.now()}`),
            subscriptionId: null, // link depois
            amount: Math.round((data.amount ?? pre?.price ?? 0) / 100), // centavos → reais
            currency: config.MERCADOPAGO_CURRENCY,
            status: 'paid',
            paidAt: new Date(),
            rawPayloadJson: payload as any,
          },
        }).catch(() => { /* duplicata de renovação — idempotente pelo gateway id */ });
        if (pre?.next_payment_date) {
          await prisma.subscription.updateMany({
            where: { userId, gatewaySubscriptionId: preapprovalId },
            data: {
              status: 'active',
              currentPeriodStart: pre.next_payment_date ? new Date(pre.start_date) : null,
              currentPeriodEnd: new Date(pre.next_payment_date),
            },
          });
        }
      }
      break;
    }
    case 'suscription_charged': {
      // Pagamento criado (ainda pendente) — registrar como pending
      const pre = preapprovalId ? await mpFetch(`/preapproval/${preapprovalId}`) : null;
      if (pre?.external_reference) {
        await prisma.payment.create({
          data: {
            gateway: 'mercadopago',
            gatewayPaymentId: String(data.id ?? payload.id),
            amount: Math.round((data.amount ?? pre.price ?? 0) / 100),
            currency: config.MERCADOPAGO_CURRENCY,
            status: 'pending',
            rawPayloadJson: payload as any,
          },
        }).catch(() => {});
      }
      break;
    }
    case 'suscription_canceled':
    case 'preapproval_canceled': {
      const pre = preapprovalId ? await mpFetch(`/preapproval/${preapprovalId}`) : null;
      if (pre?.external_reference) {
        await prisma.subscription.updateMany({
          where: { userId: pre.external_reference, gatewaySubscriptionId: preapprovalId },
          data: { status: 'canceled' },
        });
        logger.info({ userId: pre.external_reference, preapprovalId }, 'assinatura MP cancelada');
      }
      break;
    }
    case 'suscription_updated': {
      const pre = preapprovalId ? await mpFetch(`/preapproval/${preapprovalId}`) : null;
      if (pre?.external_reference) {
        await prisma.subscription.updateMany({
          where: { userId: pre.external_reference, gatewaySubscriptionId: preapprovalId },
          data: {
            currentPeriodStart: pre.start_date ? new Date(pre.start_date) : null,
            currentPeriodEnd: pre.next_payment_date ? new Date(pre.next_payment_date) : null,
            status: pre.auto_renew ? 'active' : 'canceled',
          },
        });
      }
      break;
    }
    default:
      logger.debug({ topic }, 'evento de webhook MP ignorado');
  }
}
