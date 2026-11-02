# 02 — Modelo de Dados (PostgreSQL)

DDL completo em [`schema.sql`](../schema.sql). Esta pasta explica decisões e políticas de retenção.

## Diagrama textual

```
users ───┬─── sessions          (refresh token hashed)
         ├─── password_resets   (token hashed, single-use, 1h)
         ├─── subscriptions ─── payments            (gateway_customer/subscription_id, status, period)
         ├─── searches ──┬── leads ──────── (place_id + coordenadas + flags + ai_score/reason/pitch)
         │              │                  ▲
         │              └── exports        └── lead_snapshots (TTL 30d máx — cache Google)
         └─── audit_logs

webhook_events (UNIQUE (gateway, event_id) → idempotência)
```

## Tabelas-chave e políticas

| Tabela | Chave natural | Índices | Política de retenção |
|---|---|---|---|
| `users` | `email` (CITEXT, único, lowercase) | email | até cancelamento de conta (GDPR-style: account deletion apaga cascata) |
| `sessions` | refresh token (SHA-256, único) | `user_id` | expiry 30d; revoked ao logout |
| `password_resets` | token (SHA-256, único) | `user_id` | 1h; single-use (`used_at`) |
| `subscriptions` | `gateway_subscription_id` (único) | `(user_id, status)` | mantém histórico de cancelamento para contabilidade |
| `payments` | `(gateway, gateway_payment_id)` único | `(subscription_id, created_at)` | payload JSON limitado; política de descarte anual (LGPD) |
| `searches` | — | `(user_id, created_at desc)` | histórico do usuário; usado para painel de uso |
| `leads` | `UNIQUE (user_id, place_id)` — **idempotência** | `(user_id, search_id)`, `place_id` | **não armazena nome/endereço do Google**; place_id + coordenadas = cache permitido |
| `lead_snapshots` | `place_id` (PK) | `expires_at` | TTL máx 30 dias (`GOOGLE_SNAPSHOT_TTL_DAYS`); job noturno purga; `0` = desativado (estrito) |
| `exports` | — | `(user_id, created_at desc)` | metadados; arquivo transiente (não persiste dados do Google) |
| `webhook_events` | `UNIQUE (gateway, event_id)` | `processed_at` | garantia de idempotência; arquivo do evento até revogação |
| `audit_logs` | — | `(user_id, created_at)` | 90 dias (LGPD: minimizar) |

## Decisões críticas

1. **Idempotência em dois níveis**
   - leads: `UNIQUE (user_id, place_id)` → buscar a mesma cidade/categoria duas vezes não duplica leads.
   - webhooks: `UNIQUE (gateway, event_id)` → evento rejogado pelo gateway (redelivery) não muda estado duas vezes.

2. **Conformidade Google (ToS) no schema**
   - `leads` guarda `place_id`, `lat/lng`, flags booleanas (`website_present`, `phone_present`) e a pontuação da IA. Nada disso é "conteúdo" da Places API no sentido estrito, e `place_id` + coordenadas são explicitamente o cache permitido.
   - `lead_snapshots` (nome/endereço/telefone) é **TTL-limitado** e purgado nightly. Se a interpretação jurídica for estrita, `GOOGLE_SNAPSHOT_TTL_DAYS=0` desliga a camada e o CSV re-fetcha do Google no momento da exportação.

3. **Multi-tenant no schema**
   - Cada tabela de usuário tem `user_id` com FK `ON DELETE CASCADE`. A camada de app (middleware + Prisma) sempre passa `userId` — sem `user_id` não há acesso, por definição.

4. **CITEXT para e-mail** — case-insensitive na DB, evita `Foo@x.com` vs `foo@x.com` (e `WHERE` ingênuo).

5. **JSONB (`filters_json`, `payload_json`, `raw_payload_json`)** — schema flexível para filtros/gateway sem migration constant, indexável quando necessário.
