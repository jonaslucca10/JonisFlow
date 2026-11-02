# 03 — Arquitetura Técnica

## Stack

| Camada | Escolha | Justificativa |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | SSR/landing, rotas protegidas `(auth)`, cookies httpOnly, deployment em Vercel/Railway |
| Backend | Node.js + Express + TypeScript + Prisma | API REST simples, tipagem no limite, migrations versionadas; NestJS considerado e descartado por boilerplate (MVP enxuto) |
| Banco | PostgreSQL (Neon/Supabase/RDS em prod; docker-compose em dev) | JSONB, CITEXT, constraints nativas; Prisma como único access point |
| Fila | BullMQ + Redis | e-mails transacionais e processamento de webhooks com retry/backoff |
| Gateway | Stripe (Checkout + Webhook) | Checkout hospedado (PCI reduzido), webhook assinado; Mercado Pago documentado como alternativa |
| E-mails | Resend (HTTP/SMTP) | bounce/complaints tratados; SMTP universais (Postmark/SendGrid) compatibles |
| IA | módulo `ai-scoring` plugável: heurísticas + LLM opcional (OpenAI-compatível) | heurísticas sempre funcionam (zero custo, zero dependência); LLM como acréscimo |
| Backup | `pg_dump` noturno → gzip → S3/R2, retenção 7–30d | `restore.sh` documentado e testado |
| Monitoramento | `/api/health` + UptimeRobot/Better Stack → Telegram/WhatsApp/SMS | alerta de queda no celular, latência, SSL |

## Diagrama de fluxo — Busca → API → Google → filtro → IA → banco → frontend

```
┌──────────┐  (1) POST /api/search  {city, category, filters}  ┌──────────────────────────────┐
│ Dashboard │ ────────────────────────────────────────────────▶ │  auth middleware            │
│ (Next.js) │         cookies httpOnly (JWT access+refresh)     │  → req.user (user_id)       │
└──────────┘                                                    └──────────────┬─────────────┘
                                                                        (2) POST /searches ─┐
                                                                        (3) Google Places   │
                                                                        Text Search         │
                                                                        (city + category)    ▼
                                                                        (4) Filtro: website ausente / telefone presente
                                                                        ▼
                                                                        (5) IA scoring: score + reason + suggested_pitch
                                                                        ▼
                                                                        (6) INSERT leads ON CONFLICT (user_id, place_id) DO NOTHING
                                                                        snapshot: save TTL ≤30d (config)
                                                                        ▼
                                                                        (7) GET /api/leads (paginado) → tabela no frontend
                                                                        (8) POST /api/exports → CSV transiente (download imediato)
```

## Diagrama de fluxo — Checkout → gateway → webhook → assinatura ativa

```
Frontend ── POST /api/billing/checkout ──▶ API ── Stripe Checkout Session ──▶ Stripe hosted page
                                                       │                        (usuário paga)
                                                       ▼
                                      webhook POST /api/billing/webhook
                                       ① verificação de assinatura (constructEvent, timing-safe)
                                       ② INSERT webhook_events (UNIQUE gateway+event_id) → idempotência
                                       ③ em checkout.session.completed → upsert subscription (active)
                                       ④ em invoice.paid → payments (paid)
                                       ⑤ em customer.subscription.deleted → status canceled
                                       ⑥ invoice.payment_failed → e-mail falha de cobrança + past_due
                                       ⑦ redelivery do gateway → evento já processado = 200 OK sem efeito
```

## Segurança na arquitetura (pontos críticos)

1. **Cookies httpOnly + SameSite=Lax** — XSS não rouba token; CSRF limitado (SameSite + endpoints mutantes exigem JSON content-type).
2. **Access token curto (15m) + refresh token rotativo** — refresh tokens são hash (SHA-256) em `sessions`, revogáveis.
3. **Multi-tenant no middleware** — `requireAuth` popula `req.user.id`; nenhum handler acessa dados sem `userId`.
4. **Rate limiting** — `/auth/*` (20/15min por IP) e `/search` (10/min por usuário) — brute force e abuso de Google API custo.
5. **Secrets fora do código** — só `.env` local / cofre do provedor; chaves do Google/Stripe/LLM nunca no frontend.
6. **Webhook assinado** — `stripe.webhooks.constructEvent` com secret; rejeita spoofing.

## Armazenamento de dados do Google (ToS)

- Permitido: `place_id` + coordenadas em `leads`, TTL ≤ 30d.
- Snapshot de nome/endereço/telefone: `lead_snapshots` com `expires_at`, purgado nightly. Set `GOOGLE_SNAPSHOT_TTL_DAYS=0` para modo estrito (re-fetch na exportação).
- Export CSV: arquivo transiente gerado no momento, link curto, não persistido — reforça minimizaÇÃO.
- Scraping (Apify/próprio): **desativado por padrão** (`GOOGLE_SCRAPE_ENABLED=false`); risco jurídico e de bloqueio documentado.
