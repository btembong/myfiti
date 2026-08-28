CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id              UUID REFERENCES classes(id),
  member_id             UUID REFERENCES members(id),
  status                TEXT DEFAULT 'confirmed',
  -- confirmed | waitlisted | cancelled | attended | no_show
  waitlist_position     INT,
  waitlist_promoted_at  TIMESTAMPTZ,
  waitlist_confirm_by   TIMESTAMPTZ,
  booked_at             TIMESTAMPTZ DEFAULT now(),
  cancelled_at          TIMESTAMPTZ,
  attended_at           TIMESTAMPTZ,
  UNIQUE(class_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_class  ON bookings(class_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
