-- Must be first — tracks applied migrations within this tenant schema
CREATE TABLE IF NOT EXISTS migration_history (
  id          SERIAL PRIMARY KEY,
  filename    TEXT UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT now()
);
