-- Global webhook event log — all providers (Tranzak, etc.)
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,                     -- tranzak
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,                     -- payment.complete | payment.failed | refund.complete
  payload      JSONB NOT NULL,
  status       TEXT DEFAULT 'pending',            -- pending | processed | failed
  processed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status  ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);
