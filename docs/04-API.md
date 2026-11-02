# 04 — API (Express + TypeScript)

Base: `/api`. Auth: cookie `jf_access` (httpOnly, 15m) + `jf_refresh` (httpOnly, 30d, rotativo).
Erros padronizados: `{ error: { code, message, details? } }`.
**Todas** as rotas protegidas passam pelo middleware `requireAuth` — `userId` obrigatório em toda query.

## Autenticação

| Método | Rota | Request | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` | `201 { id, email, name }` + cookies + e-mail de boas-vindas |
| POST | `/api/auth/login` | `{ email, password }` | `200 { id, email, name }` + cookies; `401` inválido |
| POST | `/api/auth/refresh` | cookie `jf_refresh` | `200` renova cookies |
| POST | `/api/auth/logout` | cookies | `204` revoke refresh token |
| POST | `/api/auth/forgot-password` | `{ email }` | `202` (sem leak de e-mail existente) + e-mail com link |
| POST | `/api/auth/reset-password` | `{ token, password }` | `200`; `400` token inválido/usado/expirado |
| GET | `/api/auth/me` | cookies | `200 { id, email, name, subscription }` |

## Busca e Leads

| Método | Rota | Request | Response |
|---|---|---|---|
| POST | `/api/search` | `{ query, city, category, filters: { semSite?: bool, temTelefone?: bool }, limit }` | `201 { searchId, resultsCount }` — registra a busca |
| GET | `/api/leads` | query: `searchId`, `page`, `pageSize`, `minScore`, `temTelefone` | `200 { items: Lead[], total, page, pageSize }` |
| GET | `/api/searches` | — | histórico do usuário (multi-tenant) |
| DELETE | `/api/leads/:id` | — | `204` (mark deleted / remove do bucket do usuário) |

**Lead (resposta):** `{ id, placeId, lat, lng, websitePresent, phonePresent, rating, userRatings, aiScore, aiReason, suggestedPitch, snapshot: { name, address, phone } | null }`

## Exportação

| Método | Rota | Request | Response |
|---|---|---|---|
| POST | `/api/exports` | `{ searchId, format: "csv" }` | `201 { id, format, rowsCount, downloadUrl, expiresAt }` — CSV transiente (minimização; não persistido) |
| GET | `/api/exports/:id` | — | metadados (`403` se `user_id` diferente) |
| GET | `/api/exports/:id/download` | — | `text/csv` com `Content-Disposition: attachment` |

## Assinatura / Billing (Stripe + Mercado Pago)

| Método | Rota | Request | Response |
|---|---|---|---|
| GET | `/api/billing/subscription` | cookies | `{ status, plan, currentPeriodEnd, cancelAtPeriodEnd }` |
| POST | `/api/billing/checkout` | `{ gateway?: "stripe"\|"mercadopago", priceId? }` | `{ url, gateway? }` — redirect para Checkout hospedado do gateway |
| POST | `/api/billing/cancel` | cookies | `200` — cancela no gateway da assinatura ativa (Stripe: fim do período; MP: cancelamento do preapproval) |
| POST | `/api/billing/webhook` | Stripe raw body (sem JSON parse!) + `stripe-signature` | `200 { received: true }` — assinatura verificada + idempotência |
| POST | `/api/billing/mercadopago/webhook` | MP JSON body + `x-signature` | `200 { received: true }` — HMAC-SHA256 verificado + idempotência |

**Mercado Pago:** checkout via preapproval (`POST /preapproval` → redirect para `subscriptions/checkout`). Eventos: `preapproval_approved` → ativa; `suscription_auto_renew` → pagamento + novo período; `suscription_canceled`/`preapproval_canceled` → canceled. `external_reference` do preapproval = user_id (multi-tenant no webhook).

## Health / IA / Utilitários

| Método | Rota | Request | Response |
|---|---|---|---|
| GET | `/api/health` | — | `200 { status: "ok", db, redis, uptime }` (uptimerobot/better stack) |
| POST | `/api/ai/score` | `{ placeId?, websitePresent, phonePresent, rating, userRatings, category, city }` | `200 { score, reason, suggestedPitch, method }` — heurísticas ou LLM |
| GET | `/api/usage` | cookies | `{ searchesUsed, searchesLimit, exportsUsed, exportsLimit }` (plano grátis: 3 buscas/5 exports — configurable) |

## Respostas de erro

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" } }
{ "error": { "code": "GOOGLE_API_ERROR", "message": "Upstream error", "details": "request id" } }
```

## Observações

- **Rate limiting:** `/api/auth/*` 20/15min por IP; `/api/search` 10/min por usuário (Redis em multi-instância).
- **Cors:** só `WEB_URL` configurado (produção: domínio próprio).
- **Webhook:** raw body via `express.raw({ type: "application/json" })` — o Stripe exige body exato para assinatura.
- **idempotência:** `webhook_events UNIQUE(gateway, event_id)`; leads `UNIQUE(user_id, place_id)`.
