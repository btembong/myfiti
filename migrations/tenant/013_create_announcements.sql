CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  target       TEXT DEFAULT 'all',         -- all | active | trainers
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_at DESC);
