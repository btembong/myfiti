CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1;

CREATE TABLE IF NOT EXISTS staff (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                 TEXT NOT NULL,
  last_name                  TEXT NOT NULL,
  email                      TEXT UNIQUE NOT NULL,
  password_hash              TEXT NOT NULL,
  role                       TEXT NOT NULL,   -- owner | admin | receptionist | trainer
  trainer_id                 UUID,            -- FK added after trainers table created
  is_active                  BOOLEAN DEFAULT true,
  password_reset_token_hash  TEXT,
  password_reset_expires_at  TIMESTAMPTZ,
  last_login_at              TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
