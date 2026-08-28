CREATE TABLE IF NOT EXISTS class_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,         -- HIIT, Yoga, Spin, Boxing
  description      TEXT,
  duration_minutes INT NOT NULL,
  color            TEXT,
  icon             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id    UUID REFERENCES class_types(id),
  trainer_id       UUID REFERENCES trainers(id),
  room             TEXT,
  capacity         INT NOT NULL,
  waitlist_limit   INT DEFAULT 10,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  status           TEXT DEFAULT 'scheduled',  -- scheduled | live | completed | cancelled
  notes            TEXT,
  is_recurring     BOOLEAN DEFAULT false,
  recurrence_rule  TEXT,                      -- RRULE string
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_scheduled  ON classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_classes_status     ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_trainer    ON classes(trainer_id);
