# 08 — Estratégia de Validação antes de Escalar

## Objetivo

Provar **demanda real e disposição a pagar** antes de investir em infra e features avançadas.

## Plano

### Semana 1 — Gestão manual de leads
- **Nicho escolhido (default): salões de beleza em Belo Horizonte.** (Altere se outro nicho for melhor — ex.: restaurantes em SP.)
- Use o JonisFlow **manualmente** (MVP já feito): busque por cidade/bairro + categoria, filtre "sem site", pontue com a IA, exporte CSV.
- Objetivo: **50 leads válidos** (telefone, endereço consistente). Caso a API oficial seja muito cara/falha para isso, use Apify com **ciência do risco** (documentar; validação pontual, não em prod).

### Semana 2 — Oferta a 10 agências/freelancers
- Canal: LinkedIn/Instagram/WhatsApp de agências web locais + comunidades de freelancers.
- Oferta: "Lista de 50 empresas sem site em Belo Horizonte, com pontuação de prioridade e abordagem sugerida — experimente o JonisFlow (plano grátis: 3 buscas)".
- Coletar feedback estruturado:
  - Qual o maior problema? (busca, filtro, pontuação, export, preço?)
  - O que fariam diferente?
  - Disposição a pagar: mensalidade razoável para sua necessidade?

### Semana 3 — Conversão
- Oferecer plano pago (ex.: R$ 79/mês — ajustar com feedback; limite de buscas/exportações).
- **Critério de escala:** >= **3–5 pagamentos recorrentes** (MRR > 0) e retenção >= 2 meses.

## Metricas de validação

| Métrica | Sucesso |
|---|---|
| Leads válidos gerados (manual) | >= 50 |
| Taxa de resposta agências | >= 50% (5/10) |
| Pagamentos recorrentes | >= 3 (de preferência 5) |
| Retenção (2 meses) | >= 60% |
| CPL (custo por lead) | <= 30% do preço mensal |
| ICP (ideal customer profile) | agências com <10 pessoas, servindo pequenas empresas locais |

## Gate de investimento

```
Se (pagamentos_recorrentes >= 3) e (retencao >= 60%) → escalar:
  - infra (replica, multi-region)
  - features nice-to-have (Receita Federal, filtros salvos, painel de uso)
  - SDR/prospecção
Else → iterate no MVP (preço, nicho, valor) antes de gastar.
```
