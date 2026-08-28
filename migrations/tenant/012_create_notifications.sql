CREATE TABLE IF NOT EXISTS notifications (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id),
  type      TEXT NOT NULL,
  -- subscription_expiring | subscription_expired | grace_period | suspended |
  -- payment_failed | payment_success | class_reminder | class_cancelled |
  -- booking_confirmed | waitlist_promoted | announcement | referral_converted
  channel   TEXT NOT NULL,               -- push | sms | email | in_app
  title     TEXT NOT NULL,
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ,
  read_at   TIMESTAMPTZ,
  metadata  JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member  ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(member_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
