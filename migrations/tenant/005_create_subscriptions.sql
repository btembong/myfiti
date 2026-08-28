CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id                 UUID REFERENCES members(id),
  plan_id                   UUID REFERENCES membership_plans(id),
  status                    TEXT NOT NULL DEFAULT 'active',
  -- active | expiring_soon | grace_period | suspended | paused | cancelled
  started_at                TIMESTAMPTZ NOT NULL,
  expires_at                TIMESTAMPTZ NOT NULL,
  grace_expires_at          TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  paused_at                 TIMESTAMPTZ,
  pause_resume_at           TIMESTAMPTZ,        -- auto-resume date
  auto_renew                BOOLEAN DEFAULT true,
  renewal_reminder_sent_at  TIMESTAMPTZ,
  suspension_notified_at    TIMESTAMPTZ,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_member   ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires  ON subscriptions(expires_at);
