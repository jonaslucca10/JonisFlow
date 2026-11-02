# 06 — Conformidade: Google ToS / LGPD / Segurança

## 1. Termos do Google (Maps/Places Platform Terms)

| Regra | Implementação no JonisFlow |
|---|---|
| Não armazenar permanentemente nome comercial, endereço ou avaliação da Places API | `leads` guarda **apenas** `place_id`, `lat/lng`, flags booleanas e pontuação da IA. `lead_snapshots` (nome/endereço/telefone) é TTL-limitado (≤30d, `GOOGLE_SNAPSHOT_TTL_DAYS`) e purgado nightly. |
| Cache permitido: `place_id` + coordenadas, ≤ 30 dias | `leads` nunca expira por padrão (são dados *derivados* + place_id, não conteúdo); `lead_snapshots.expires_at <= fetched_at + 30d`. Job noturno purga. |
| Modo estrito | `GOOGLE_SNAPSHOT_TTL_DAYS=0` desliga snapshots: a UI e o CSV re-fetcham dados display direto do Google no momento da necessidade. |
| Scraping (Apify/próprio) | **Desativado por padrão** (`GOOGLE_SCRAPE_ENABLED=false`). Riscos: violação de ToS, bloqueio de IP/multa por termos, falha de qualidade. A API oficial é o caminho padrão e recomendado. |
| Atribuição / license | `attributions` do Google preservados em UI; não remover marca. |
| Rate limits / billing | Watch billing alerts no console; limit de buscas por usuário no app (plano grátis 3 buscas/mês) → custo controlado. |

**Checklist de mitigação de ToS**
- [ ] `GOOGLE_MAPS_API_KEY` restrita por domínio/IP no console (não "anywhere").
- [ ] `GOOGLE_SNAPSHOT_TTL_DAYS` documentado na deploy (30 ou 0) — escolha consciente, registrada.
- [ ] Nightly purga de `lead_snapshots` + alerta de falha.
- [ ] E-mail claro no produto: "dados do Google; sem garantia de disponibilidade".

## 2. LGPD

| Princípio | Implementação |
|---|---|
| **Pesos juridicamente protegidos** | Empresas (CNPJ) — razão social, endereço, CNAE — **não** são dados pessoais protegidos pela LGPD. Dados de pessoas físicas (nome de sócio, e-mail nominal, celular pessoal) **fora do MVP** (escopo explicitamente excluído). |
| Base legal | Prospecção B2B com base em interesse legítimo (Art. 7, IX). No produto: explicar na Política de Privacidade; opt-out por e-mail/canal de atendimento. |
| Minimização | Snapshots TTL; CSV transiente; `audit_logs` 90d; payloads de webhook limitados. |
| Direito de oposição/exclusão | Camada `users` com delete account (cascata) + canal de contato na Política de Privacidade. Se interpretarmos leads como dados pessoais, oferecer `DELETE /api/account` (Fase 6: destroy leads do usuário). |
| Retenção | Backup retido 7–30d; `payments.raw_payload_json` com descarte anual. |

**Checklist LGPD**
- [ ] Política de Privacidade publicada (funcionalidade: landing / footer).
- [ ] Mecanismo de opt-out (e-mail + botão no produto).
- [ ] Dados de pessoas físicas: **zero** no MVP (Receita Federal: só CNPJ/CNAE/situação cadastral).
- [ ] Registro de base legal (documento interno, simples).

## 3. Segurança

- [ ] Sem hardcode: `.env` local, cofre do provedor (Railway/Render/Fly/Vercel secrets).
- [ ] bcrypt cost 10; JWT access 15m; refresh tokens SHA-256 em `sessions`, rotativos e revogáveis.
- [ ] Cookies httpOnly + Secure (prod) + SameSite=Lax.
- [ ] Rate limiting em `/auth/*` (20/15min/IP) e `/search` (10/min/user).
- [ ] Multi-tenant no middleware: `userId` obrigatório em toda query.
- [ ] Webhook assinado: Stripe (`constructEvent`) e Mercado Pago (HMAC-SHA256 raw body vs `x-signature`) + idempotência (`UNIQUE (gateway, event_id)`).
- [ ] Input validation com zod; SQL via Prisma (não strings manuais).
- [ ] Security headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options.
- [ ] HTTPS só; CORS restrito ao domínio próprio.
- [ ] Dependências auditadas (`npm audit`, renovate/dependabot).
- [ ] Logs sem secrets (pino redact); segregação de ambientes.
- [ ] Secrets rotation: processo documentado (strike key, rotate).

## Política de retenção de dados

| Dado | Retenção |
|---|---|
| `leads` / `searches` / `exports` | até cancelamento de conta (cascata) |
| `lead_snapshots` | ≤30 dias (purgado nightly) |
| `audit_logs` | 90 dias |
| `payments.raw_payload_json` | 1 ano (descarte com job) |
| `backups` | 7–30 dias (rotação automática) |
