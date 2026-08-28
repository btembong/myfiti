CREATE TABLE IF NOT EXISTS check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID REFERENCES members(id),
  method          TEXT NOT NULL,             -- qr | pin | manual
  checked_in_at   TIMESTAMPTZ DEFAULT now(),
  checked_out_at  TIMESTAMPTZ,
  staff_id        UUID REFERENCES staff(id), -- if manual override
  blocked         BOOLEAN DEFAULT false,
  block_reason    TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_check_ins_member   ON check_ins(member_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_date     ON check_ins(checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_blocked  ON check_ins(blocked) WHERE blocked = true;
