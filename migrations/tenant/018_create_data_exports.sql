CREATE TABLE IF NOT EXISTS data_export_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID REFERENCES members(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at   TIMESTAMPTZ
);
