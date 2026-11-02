import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../lib/logger';

// Transport SMTP (Resend, Postmark, SendGrid são compatíveis). Sem credentials
// em código — tudo via env. Se SMTP_HOST estiver vazio, e-mails vão pro log
// (dev apenas; em prod é erro).
const transport = nodemailer.createTransport({
  host: config.SMTP_HOST || 'localhost',
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
});

export type MailKind = 'welcome' | 'password_reset' | 'billing_confirmed' | 'billing_failed';

const templates: Record<MailKind, (d: Record<string, string>) => { subject: string; html: string }> = {
  welcome: ({ name }) => ({
    subject: `Bem-vindo(a), ${name}!`,
    html: `<p>Olá ${name},</p><p>Sua conta JonisFlow está pronta. Faça sua primeira busca: cidade/bairro + categoria, filtre "sem site" e exporte CSV.</p>`,
  }),
  password_reset: ({ name, link }) => ({
    subject: 'Redefinição de senha — JonisFlow',
    html: `<p>Olá ${name}, solicitamos a redefinição de senha.</p><p><a href="${link}">Clique para redefinir</a> (link válido por 1 hora). Se não solicitou, ignore este e-mail.</p>`,
  }),
  billing_confirmed: ({ name, amount, currency }) => ({
    subject: `Cobrança confirmada — R$ ${amount} ${currency}`,
    html: `<p>Olá ${name}, sua assinatura foi renovada com sucesso (${amount} ${currency}).</p>`,
  }),
  billing_failed: ({ name }) => ({
    subject: 'Falha na cobrança — JonisFlow',
    html: `<p>Olá ${name}, houve uma falha na cobrança do seu plano. Atualize seu cartão no link abaixo para não perder o acesso.</p>`,
  }),
};

/** Enviar via fila (BullMQ) quando Redis disponível; senão, direto (dev). */
export async function dispatchMail(kind: MailKind, data: Record<string, string>) {
  try {
    const { mailQueue } = await import('../../lib/queues');
    await mailQueue.add('send', { kind, data }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 });
  } catch (e) {
    await sendMail(kind, data); // fallback síncrono (Redis down: não perde e-mail)
  }
}

export async function sendMail(kind: MailKind, data: Record<string, string>) {
  if (!config.SMTP_HOST) {
    // Dev: não falha a flux por e-mail, mas registra.
    logger.warn({ kind, data }, 'SMTP não configurado — e-mail não enviado (dev)');
    return;
  }
  const t = templates[kind](data);
  await transport.sendMail({ from: config.MAIL_FROM, to: data.email, subject: t.subject, html: t.html });
}
