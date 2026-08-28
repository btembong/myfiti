CREATE TABLE IF NOT EXISTS operating_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INT NOT NULL,      -- 0=Sunday, 1=Monday ... 6=Saturday
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  is_closed   BOOLEAN DEFAULT false,
  UNIQUE(day_of_week)
);

CREATE TABLE IF NOT EXISTS operating_hour_exceptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL UNIQUE,
  opens_at   TIME,
  closes_at  TIME,
  is_closed  BOOLEAN DEFAULT false,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default operating hours (Mon–Sat 6am–10pm, Sunday closed)
INSERT INTO operating_hours (day_of_week, opens_at, closes_at, is_closed) VALUES
  (0, '08:00', '18:00', true),   -- Sunday
  (1, '06:00', '22:00', false),  -- Monday
  (2, '06:00', '22:00', false),  -- Tuesday
  (3, '06:00', '22:00', false),  -- Wednesday
  (4, '06:00', '22:00', false),  -- Thursday
  (5, '06:00', '22:00', false),  -- Friday
  (6, '07:00', '20:00', false)   -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;
