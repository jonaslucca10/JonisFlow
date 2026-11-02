# 07 — Riscos Técnicos, Jurídicos e de Custo

## Técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Falha de webhook** (Stripe não entrega, redelivery) | Assinatura ativa sem cobrança ou cobrança sem ativação | Idempotência `UNIQUE(gateway, event_id)` + job de reconciliação diário (compara `subscriptions` com `invoices` do gateway) + alerta |
| **Indisponibilidade do Google Places** (limite/bloqueio/5xx) | App para sem buscas | Cache TTL 30d; fallback mínimo: não perde snapshots existentes; alertas de billing/abuse; deploy em duas regiões (phase 6) |
| **Scraping ban** (se ativar Apify) | Queda de qualidade, bloqueio de IP | Padrão: API oficial; scraping com painel de aviso + fallback |
| **Redis/Postgres down** | Fila parada, app inoperante | Healthcheck + alerta; redis persistence AOF; replica de leitura (phase 6) |
| **Backup inválido** (backup "existente" nunca restaurado) | Perda total em disaster | Restore testado mensal em staging (runbook `scripts/restore.sh`); retenção dupla (local + S3/R2) |
| **Expansão de stored snapshots** | Custo de storage + ToS | TTL 30d; purga nightly; alerta de crescimento |
| **AI provider outage** | Scoring degradado | Heurísticas são o floor (sempre funcionam); LLM opcional; fallback silente |
| **Multi-tenant leak** (query sem user_id) | Dados de outro usuário expostos | Middleware obrigatório + testes de acesso cruzado; code review obrigatório em `leads`/`exports`/`searches`; Prisma `$transaction` para escopo do usuário |

## Jurídicos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Violação de ToS do Google** | Multa, suspensão de conta, obrigação de pagar por uso | API oficial padrão; snapshot TTL ≤30d; modo estrito (0 dias); opt-out por e-mail; não remover attributions |
| **LGPD** (se coletar dados de PF) | Multa ANPD, obrigações | MVP só empresas (CNPJ); política de privacidade; minimização; opt-out; exclusão de conta por cascata |
| **Direitos autorais** (nomes/marcas nos CSV) | Ação civil | CSV com place_id + dados públicos; política de uso aceitável; não redistribuir lists |
| **Cobrança** (chargeback, disputa) | Perda financeira | Stripe + Mercado Pago com dispute handling; confirmação de cobrança por e-mail; faturas registradas em `payments`; reconciliação diária |
| **Falha de webhook do MP** (redelivery, assinatura de cartão) | Assinatura ativa sem cobrança | Idempotência `UNIQUE(gateway, event_id)` + reconciliation job + alerta de `preapproval_approved` não processado |
| **Sandbox/prod do MP** (configuração de preapproval, chave) | Checkout quebrado | Testar preapproval em sandbox primeiro; documentar passo a passo no runbook de deploy |

## Custo

| Item | Custo estimado | Mitigação |
|---|---|---|
| Google Places Text Search | ~US$ 32 por 10k solicitações (pay-as-you-go) | Plano grátis limitado (3 buscas/mês no MVP); alerta de billing; snapshot cache reduz chamados; transformar em custo por lead vendido |
| Stripe | 2,9% + R$0,50 por transação | Passar para mensalidade (receita recorrente); incluir custo no preço |
| Postgres gerenciado (Neon/Supabase/RDS) | US$ 0–19/mês (hobby) | Escolha por região; backup incluso |
| Redis | US$ 5–15/mês (Railway/Upstash) | Upstash (serverless) opção; Fila pode ser apenas e-mail/webhook |
| E-mail (Resend) | US$ 20/mês (10k e-mails) ou free tier | Volume baixo no MVP |
| Monitoramento (UptimeRobot/Better Stack) | Free–US$ 20/mês | Free tier cobre MVP |
| Storage backup (R2/S3) | US$ 0,01/GB/mês | Retenção 7–30d, compressão gzip |

## Risco de mercado

- **Demonstração de valor antes de escalar** (§08): só expandir infra/funcionalidades após 3–5 pagamentos recorrentes e 50 leads de um nicho em validação.
