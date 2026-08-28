CREATE TABLE IF NOT EXISTS push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID REFERENCES members(id) ON DELETE CASCADE,
  expo_token   TEXT NOT NULL,
  platform     TEXT NOT NULL,              -- ios | android
  is_active    BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, expo_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_member ON push_tokens(member_id);
