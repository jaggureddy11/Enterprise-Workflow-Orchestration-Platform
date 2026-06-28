-- Initialize public schema with system tables
CREATE SCHEMA IF NOT EXISTS public;

-- Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  plan          VARCHAR(50) NOT NULL DEFAULT 'FREE',
  status        VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs (global, cross-tenant)
CREATE TABLE IF NOT EXISTS public.audit_log_global (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID REFERENCES public.tenants(id),
  event_type    VARCHAR(100) NOT NULL,
  actor_id      UUID,
  resource_type VARCHAR(100),
  resource_id   UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_global_tenant ON public.audit_log_global(tenant_id, created_at DESC);
