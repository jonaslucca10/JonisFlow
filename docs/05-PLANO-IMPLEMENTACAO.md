# 05 — Plano de Implementação (fases, esforço, aceitação)

Esforço em **horas-pessoa (h)**. Cada fase tem **critérios de aceitação (AC)** testáveis. Todos os entregadores de código já presentes neste repo cobrem as fases 0–3; fases 4+ são roadmap.

## Fase 0 — Base do repo (neste commit) ✅
- Monorepo (`apps/api`, `apps/web`), Docker Compose (Postgres, Redis, API, Web), `.env.example`, DDL `schema.sql`, docs.
- **AC:** `docker compose up -d` leva API saudável em `/api/health` e web em `localhost:3000`.

## Fase 1 — Autenticação + multi-tenant ✅ (code complete)
- Registro/login/refresh/logout, recover de senha, rate limiting, middleware tenant, migrations.
- **AC:** token inválido → 401; user A nunca vê dados de user B (teste de acesso cruzado no API test); senhas são bcrypt (test `$2` prefix); reset token single-use.
- **Esforço:** ~12h.

## Fase 2 — Busca + filtros + IA scoring ✅ (code complete)
- Google Places Text Search (API oficial), filtro `sem site` + `tem telefone`, snapshot TTL, `ai-scoring` (heurísticas + LLM opcional), paginação.
- **AC:** busca "restaurantes em Belo Horizonte sem site" retorna leads com `websitePresent=false`; snapshot expira em ≤30d (job noturno); score 0–100 com reason; `GOOGLE_SCRAPE_ENABLED=false` por padrão.
- **Esforço:** ~16h.

## Fase 3 — Export CSV + billing (Stripe) + e-mails ✅ (code complete)
- Export transiente CSV, Checkout Stripe, webhook idempotente, e-mails via BullMQ/Resend.
- **AC:** webhook com evento repetido altera estado uma única vez; checkout ativo após `checkout.session.completed`; falha de cobrança dispara e-mail + `past_due`; CSV contém linhas do usuário apenas.
- **Esforço:** ~18h.

## Fase 4 — Hardening de operação
- Backup nightly testado (restore em ambiente staging), monitoramento (UptimeRobot/Better Stack + alerta Telegram), logs estruturados (pino → Axiom/Logtail), CORS/security headers, CSP.
- **AC:** restore de backup funciona em ≤ 30 min; alerta dispara quando `/api/health` falha; `docker compose` executa `backup.sh` e purga snapshots expirados.
- **Esforço:** ~10h.

## Fase 5 — GTM + validação (§08) 🔜
- Landing com plano/pricing, painel de uso, filtros salvos, manual: 50 leads de um nicho, oferta a 10 agências.
- **AC:** landing converte; painel mostra contagem de buscas/exportações restantes; >=3 pagamentos recorrentes (critério de escala).
- **Esforço:** ~14h (impl) + 3 semanas (validação).

## Fase 6 — Evolução (pós-validação)
- Enriquecimento Receita Federal (CNPJ → CNAE/situação), histórico/buscas salvas, CRM de abordagem, team accounts (multi-usuário por assinatura).
- **AC:** cada feature em staging com teste de LGPD (opt-out, minimização).

## Ordenação de riscos no roadmap

1. ToS Google / faturamento API (fase 2–3) → mitigação: cache TTL, snapshot opcional, Abuse/billing alerts.
2. Falha de webhook (fase 3) → idempotência + reconciliation job.
3. LGPD (fase 6) → opt-out, minimizaÇÃO, opt-out mechanics no AI scoring.

## Release checklist para produção

- [ ] `.env` sem valores reais; secrets no provedor
- [ ] HTTPS com domínio próprio; CORS só domínio próprio
- [ ] Rate limit ativado; `GOOGLE_SNAPSHOT_TTL_DAYS` explicitado (30 ou 0)
- [ ] Stripe webhook com `STRIPE_WEBHOOK_SECRET` válido (test webhook passa)
- [ ] Backup nightly executado e restore testado
- [ ] UptimeRobot/Better Stack apontando `/api/health` + alerta ao celular
- [ ] Política de privacidade + opt-out publicados
