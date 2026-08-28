CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT NOT NULL,             -- tenant currency
  provider        TEXT NOT NULL,             -- tranzak | cash | transfer
  provider_ref    TEXT,                      -- Tranzak transaction reference
  status          TEXT NOT NULL,             -- pending | successful | failed | refunded
  payment_type    TEXT NOT NULL,             -- subscription | day_pass | class_fee | penalty
  receipt_number  TEXT UNIQUE,              -- RCT-{YEAR}-{6-digit}
  receipt_url     TEXT,
  paid_at         TIMESTAMPTZ,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_member      ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_ref);
CREATE INDEX IF NOT EXISTS idx_payments_created     ON payments(created_at DESC);
