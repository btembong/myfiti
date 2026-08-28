CREATE TABLE IF NOT EXISTS trainers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  specialties TEXT[] DEFAULT '{}',
  bio         TEXT,
  status      TEXT DEFAULT 'active',   -- active | inactive
  joined_at   TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Add FK from staff to trainers now that trainers table exists
ALTER TABLE staff
  ADD CONSTRAINT fk_staff_trainer
  FOREIGN KEY (trainer_id) REFERENCES trainers(id)
  NOT VALID;
