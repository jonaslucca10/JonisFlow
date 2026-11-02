-- =============================================================================
-- JonisFlow — Modelo de dados (PostgreSQL)
-- DDL completo: tipos, chaves, índices e políticas de retenção.
-- Política do Google: NENHUMA tabela armazena permanentemente nome comercial,
-- endereço ou avaliação da Places API. leads guarda apenas place_id + coordenadas
-- + flags derivadas. lead_snapshots é TTL-limitado a 30 dias (ver docs/06).
-- =============================================================================

-- citext: e-mail case-insensitive na DB (contrib; disponível em Neon/Supabase/RDS)
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- USUÁRIOS ----------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,                       -- normalizado em lowercase pelo app
  password_hash     TEXT NOT NULL,                       -- bcrypt (cost 10)
  name              TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- unicidade case-insensitive na DB (citext alternativo via contrib)
CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));

-- ---------- SESSÕES (refresh token) ----------
CREATE TABLE sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,               -- sha256 do token; o token só vive no httpOnly cookie
  expires_at        TIMESTAMPTZ NOT NULL,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

-- ---------- RECUPERAÇÃO DE SENHA ----------
CREATE TABLE password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,                       -- sha256; token só no e-mail
  expires_at TIMESTAMPTZ NOT NULL,                        -- 1h
  used_at    TIMESTAMPTZ,                                 -- single-use
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resets_user ON password_resets (user_id);

-- ---------- ASSINATURAS ----------
CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway              TEXT NOT NULL,                    -- stripe | mercadopago
  gateway_customer_id  TEXT NOT NULL,
  gateway_subscription_id TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'inactive', -- active|trialing|past_due|canceled|inactive
  plan                 TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_user_status ON subscriptions (user_id, status);

-- ---------- PAGAMENTOS / FATURAS ----------
CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id    UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  gateway            TEXT NOT NULL DEFAULT 'stripe',
  gateway_payment_id TEXT,                               -- idempotência secundária no gateway
  amount             NUMERIC(12,2) NOT NULL,
  currency           CHAR(3) NOT NULL DEFAULT 'BRL',
  status             TEXT NOT NULL,                      -- paid|refunded|failed|pending
  paid_at            TIMESTAMPTZ,
  raw_payload_json   JSONB NOT NULL DEFAULT '{}'::jsonb, -- retenção limitada; aplique política de descarte
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_payment_id)                   -- garante idempotência
);
CREATE INDEX idx_payments_sub ON payments (subscription_id, created_at DESC);

-- ---------- BUSCAS (registo da pesquisa do usuário) ----------
CREATE TABLE searches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query          TEXT NOT NULL,                          -- string de busca do usuário
  city           TEXT NOT NULL,
  category       TEXT NOT NULL,
  filters_json   JSONB NOT NULL DEFAULT '{}'::jsonb,      -- sem_site, tem_telefone, etc.
  results_count  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_searches_user_time ON searches (user_id, created_at DESC);

-- ---------- LEADS ----------
-- ⚠️ Conformidade Google: NÃO armazenamos name/address/rating da Places API aqui.
--    O que persistimos: place_id (cache permitido) + coordenadas + flags booleanas
--    derivadas + pontuação da IA. Dados display (nome/endereço/telefone) vivem em
--    lead_snapshots com TTL máximo de 30 dias, expiráveis e purgáveis.
CREATE TABLE leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_id         UUID REFERENCES searches(id) ON DELETE CASCADE,
  place_id          TEXT NOT NULL,                       -- chave do Google, cache permitido
  lat               NUMERIC(10,7),
  lng               NUMERIC(10,7),
  website_present   BOOLEAN NOT NULL DEFAULT false,      -- false = "sem site" (o filtro principal)
  phone_present     BOOLEAN NOT NULL DEFAULT false,
  rating            NUMERIC(3,2),                        -- derivada/indicativa (snapshot apenas)
  user_ratings      INT,
  ai_score          SMALLINT,                            -- 0-100, priorização
  ai_reason         TEXT,                                -- explicação (scorecard)
  suggested_pitch    TEXT,                                -- abordagem sugerida pela IA
  ai_model          TEXT,
  ai_prompt_version TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)                             -- idempotência: lead repetido não gera duplicata
);
CREATE INDEX idx_leads_user_search ON leads (user_id, search_id);
CREATE INDEX idx_leads_place ON leads (place_id);

-- ---------- SNAPSHOT TTL-LIMITADO (camada de cache Google, opcional) ----------
-- Vive no máximo GOOGLE_SNAPSHOT_TTL_DAYS (máx 30, default 30; 0 = desativado).
-- Nightly job apaga tudo expirado. Em interpretações estritas da ToS, sete 0.
CREATE TABLE lead_snapshots (
  place_id     TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  website      TEXT,
  rating       NUMERIC(3,2),
  user_ratings INT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL                       -- fetched_at + 30d (nunca mais)
);
CREATE INDEX idx_snapshots_expires ON lead_snapshots (expires_at);

-- ---------- EXPORTAÇÕES ----------
CREATE TABLE exports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_id   UUID REFERENCES searches(id) ON DELETE CASCADE,
  format      TEXT NOT NULL DEFAULT 'csv',
  rows_count  INT NOT NULL DEFAULT 0,
  file_url    TEXT,                                      -- storage interno/externo (opcional)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exports_user_time ON exports (user_id, created_at DESC);

-- ---------- WEBHOOKS (idempotência) ----------
CREATE TABLE webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway      TEXT NOT NULL,                            -- stripe | mercadopago
  event_id     TEXT NOT NULL,                            -- id do evento no gateway
  event_type   TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,                              -- null = pendente/falhado
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway, event_id)                             -- idempotência: webhook rejogado é ignorado
);
CREATE INDEX idx_webhooks_processed ON webhook_events (processed_at);

-- ---------- AUDIT LOGS (opcional, útil para LGPD e compliance) ----------
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,                              -- register|login|export|delete_account...
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  meta_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user_time ON audit_logs (user_id, created_at DESC);
