CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_type  TEXT,              -- staff | member | system
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  changes     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity   ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);
