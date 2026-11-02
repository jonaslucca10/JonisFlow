import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Fallbacks de dev para evitar falhas de validação quando vars não estão definidas
if (!process.env.PORT) process.env.PORT = '4000';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

// Validação de config com zod: fail-fast em produção se secrets essenciais faltarem.
const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatória'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  APP_NAME: z.string().default('JonisFlow'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('JonisFlow <noreply@jonisflow.example.com>'),
  MAIL_RESET_URL_BASE: z.string().default('http://localhost:3000/reset-password'),
  GOOGLE_MAPS_API_KEY: z.string().default(''),
  GOOGLE_PLACE_SEARCH_URL: z.string().default('https://maps.googleapis.com/maps/api/place/textsearch/json'),
  GOOGLE_SCRAPE_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  APIFY_API_TOKEN: z.string().default(''),
  APIFY_ACTOR_ID: z.string().default(''),
  // Conformidade Google: TTL máx 30 dias; 0 = modo estrito (sem snapshots).
  GOOGLE_SNAPSHOT_TTL_DAYS: z.coerce.number().int().min(0).max(30).default(30),
  AI_LLM_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  AI_LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_LLM_API_KEY: z.string().default(''),
  AI_LLM_MODEL: z.string().default('gpt-4o-mini'),
  AI_PROMPT_VERSION: z.string().default('v1'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_ID: z.string().default(''),
  STRIPE_SUCCESS_URL: z.string().default('http://localhost:3000/billing?status=success'),
  STRIPE_CANCEL_URL: z.string().default('http://localhost:3000/billing?status=canceled'),
  // Mercado Pago (gateway alternativo — assinatura mensal via preapproval)
  DEFAULT_GATEWAY: z.enum(['stripe', 'mercadopago']).default('stripe'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  MERCADOPAGO_API_BASE: z.string().default('https://api.mercadopago.com'),
  MERCADOPAGO_MP_CHECKOUT_BASE: z.string().default('https://www.mercadopago.com.br/subscriptions/checkout'),
  MERCADOPAGO_PRICE: z.coerce.number().int().positive().default(7900), // centavos (R$ 79,00)
  MERCADOPAGO_CURRENCY: z.string().default('BRL'),
  BACKUP_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  BACKUP_DIR: z.string().default('./backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  S3_BUCKET: z.string().default(''),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),
  RATE_LIMIT_SEARCH_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_PER_15MIN: z.coerce.number().int().positive().default(20),
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // nunca começar em prod com config incompleta
  }
}

export const config = parsed.success
  ? parsed.data
  : (process.env as unknown as z.infer<typeof Schema>);

// Helpers de domínio
export const isProd = config.NODE_ENV === 'production';
export const googleSnapshotTtlDays = Math.min(Math.max(config.GOOGLE_SNAPSHOT_TTL_DAYS, 0), 30); // ToS: máx 30
export const snapshotEnabled = googleSnapshotTtlDays > 0; // modo estrito desativa snapshots
