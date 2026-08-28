CREATE TABLE IF NOT EXISTS day_passes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID REFERENCES members(id),   -- null if walk-in (no account)
  guest_name TEXT,
  guest_phone TEXT,
  amount     NUMERIC(10,2) NOT NULL,
  currency   TEXT NOT NULL,
  payment_id UUID REFERENCES payments(id),
  qr_token   TEXT,                           -- one-day signed JWT
  valid_date DATE NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_day_passes_date ON day_passes(valid_date DESC);
