CREATE TABLE IF NOT EXISTS membership_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,         -- Monthly, Quarterly, Yearly, Day Pass
  description          TEXT,
  duration_days        INT NOT NULL,
  price                NUMERIC(10,2) NOT NULL,
  currency             TEXT NOT NULL,         -- inherits tenant currency (XAF, NGN, etc.)
  max_classes_per_week INT,                   -- null = unlimited
  allows_guest         BOOLEAN DEFAULT false,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now()
);
