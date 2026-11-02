# 01 — Visão do Produto e Escopo do MVP

## Visão (1 parágrafo)

**JonisFlow** é um SaaS de prospecção para agências, freelancers e prestadores de serviços digitais: ele transforma uma busca simples (cidade/bairro + categoria) em uma lista priorizada de empresas locais **sem site** — o sinal mais forte de que um negócio não tem presença digital e, portanto, é um lead qualificado para quem vende sites, marketing ou serviços online. O produto valida a procura por demanda real em vez de inventar leads: cada resultado vem do Google Maps/Places, passa por um filtro "sem site" e "tem telefone", recebe uma **pontuação própria de IA** (probabilidade de precisar de site + abordagem sugerida) e pode ser exportado em CSV. O monetização é assinatura mensal recorrente (limite de buscas/exportações por plano), com checkout no Stripe e webhook idempotente — um produto enxuto, focado no Brasil, com as bases de segurança (multi-tenant), conformidade (Google ToS / LGPD) e operação (backup, monitoramento) para ir a produção desde o dia 1.

## Escopo do MVP

### Must have

| # | Requisito | Implementação |
|---|---|---|
| 1 | Cadastro/login com e-mail e senha (hash seguro) + recuperação de senha por e-mail | bcrypt cost 10, JWT access 15m + refresh 30d em `sessions`, token de reset single-use com expiry 1h (`apps/api/src/modules/auth`) |
| 2 | Isolamento multi-tenant | middleware `requireAuth` injeta `user_id`; **todas** as queries filtraem por `user_id` (ex.: `where: { userId }`); chave única `(user_id, place_id)` em leads |
| 3 | Busca cidade/bairro + categoria com filtros "sem site" / "tem telefone" | Text Search da Places API oficial (`apps/api/src/modules/search`); snapshot TTL 30d max (ToS) |
| 4 | Tabela de resultados com filtros e paginação | `GET /api/leads?...&page=1&pageSize=25` (`apps/web/app/dashboard`) |
| 5 | Exportação CSV | `POST /api/exports` (gera arquivo transiente; links curtos, sem persistência permanente de dados do Google) |
| 6 | Gateway de pagamento, assinatura mensal recorrente | Stripe Checkout hospedado + webhook (`apps/api/src/modules/billing`); Mercado Pago documentado como alternativa |
| 7 | Webhook idempotente (ativar/renovar/cancelar) | verificação de assinatura (`constructEvent`), chave UNIQUE `(gateway, event_id)` em `webhook_events` |
| 8 | E-mails transacionais | Resend via BullMQ (boas-vindas, recover, confirmação de cobrança, falha de cobrança) |
| 9 | API REST entre frontend e banco | Express + Prisma; frontend consuma via fetch com cookies httpOnly |
| 10 | Deploy produção (domínio, HTTPS, secrets fora do código) | Dockerfiles + compose; deploy guia em README; `.env` só local, secrets no provedor |
| 11 | Monitoramento com alerta no celular | `/api/health`, UptimeRobot/Better Stack → Telegram/WhatsApp/SMS (`scripts/alert.sh`) |
| 12 | Backup automático noturno | `scripts/backup.sh` (pg_dump → compressão → upload S3/R2, retenção 7–30d) + restore testado |
| 13 | IA própria de scoring | módulo `ai-scoring` plugável: heurísticas + LLM opcional via API (`apps/api/src/modules/ai`) |

### Nice to have

- Enriquecimento público de CNPJ (Receita Federal) → CNAE, situação cadastral (de pessoa jurídica, baixa risco LGPD; implementar como endpoint opcional `POST /api/leads/:id/enrich`).
- Filtros salvos + histórico de buscas (tabela `searches` já registra tudo; UI de histórico depois).
- Painel de uso (contador de buscas/exportações no plano — derivar de `searches`/`exports` + limites do plano).

### Fora do escopo

- App mobile nativo.
- Envio automatizado de e-mails de prospecção (deixar para fase 2 — inclui risco de spam/LGPD).
- Enriquecimento com nome de sócio, e-mail nominal ou celular pessoal (risco LGPD; explicitamente excluído).

## Princípios de produto

1. **Demanda real, não inventada** — leads vêm de dados públicos do Google, nunca de listas vendidas.
2. **Qualidade > quantidade** — filtro "sem site" é o critério de qualificação; a IA ordena.
3. **Conformidade desde o dia 1** — Google ToS e LGPD limitam o que armazenar e por quanto tempo.
4. **Prova antes de escalar** — validação com 50 leads manuais e 10 agências antes de investir em infra.
