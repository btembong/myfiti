CREATE TABLE IF NOT EXISTS members (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_no                  TEXT UNIQUE,            -- e.g. CFL-000001 (set on insert)
  first_name                 TEXT NOT NULL,
  last_name                  TEXT NOT NULL,
  email                      TEXT UNIQUE NOT NULL,
  phone                      TEXT,
  avatar_url                 TEXT,
  date_of_birth              DATE,
  gender                     TEXT,
  emergency_contact_name     TEXT,
  emergency_contact_phone    TEXT,
  notes                      TEXT,
  qr_code                    TEXT UNIQUE,            -- signed JWT for check-in
  pin                        TEXT,                   -- 4-digit PIN (hashed)
  status                     TEXT DEFAULT 'active',  -- active | suspended | inactive
  password_hash              TEXT,
  password_reset_token_hash  TEXT,
  password_reset_expires_at  TIMESTAMPTZ,
  notification_prefs         JSONB DEFAULT '{
    "push_enabled": true,
    "email_enabled": true,
    "sms_enabled": true,
    "class_reminders": true,
    "subscription_alerts": true,
    "milestones": true,
    "announcements": true
  }',
  terms_accepted_at          TIMESTAMPTZ,
  terms_version              TEXT,
  data_deletion_requested_at TIMESTAMPTZ,
  data_deleted_at            TIMESTAMPTZ,
  referral_code              TEXT UNIQUE,            -- e.g. AMAKA891
  referred_by_id             UUID REFERENCES members(id),
  joined_at                  TIMESTAMPTZ DEFAULT now(),
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_email    ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_status   ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_member_no ON members(member_no);
CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);
