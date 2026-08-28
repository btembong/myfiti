-- GymFlow platform subscriptions (gym owner pays GymFlow)
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id),
  plan                 TEXT NOT NULL,
  status               TEXT NOT NULL,             -- active | cancelled | past_due
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  tranzak_ref          TEXT,                       -- Tranzak transaction reference
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
