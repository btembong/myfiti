-- V1: Referral system — unique links, sign-up attribution, reward ledger
CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID REFERENCES members(id),
  referred_id       UUID REFERENCES members(id),
  status            TEXT DEFAULT 'pending',   -- pending | converted | rewarded
  converted_at      TIMESTAMPTZ,
  reward_days       INT,                      -- free days added to referrer's subscription
  reward_amount     NUMERIC(10,2),            -- discount amount (alternative reward)
  reward_applied_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON referrals(status);
