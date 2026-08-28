CREATE TABLE IF NOT EXISTS superadmin_staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  mfa_secret    TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES superadmin_staff(id),
  action      TEXT NOT NULL,
  tenant_id   UUID REFERENCES tenants(id),
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_tenant ON superadmin_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON superadmin_audit_logs(created_at DESC);
