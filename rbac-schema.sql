-- ============================================================
-- ADMIN ROLES (RBAC) + AUDIT + SETTINGS — DATABASE ADDITIONS  (v3)
-- Paste the SQL below into the Supabase SQL editor (NOT the filename).
-- Safe to re-run. RUN THIS BEFORE deploying the backend, or you'll be
-- locked out (routes now require a real admin login, not the shared secret).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure the table exists (no-op if it already does).
CREATE TABLE IF NOT EXISTS admins (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add every column we rely on (works whether the table is new or an old version).
ALTER TABLE admins ADD COLUMN IF NOT EXISTS username      VARCHAR(50);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role          VARCHAR(20) DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions   JSONB       DEFAULT '[]'::jsonb;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS active        BOOLEAN     DEFAULT true;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by    INTEGER;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_at    TIMESTAMP   DEFAULT NOW();

-- Relax any legacy NOT-NULL columns (e.g. email) the app doesn't populate,
-- so seeding the super admin and creating normal admins both work.
DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_name='admins' AND is_nullable='NO'
      AND column_default IS NULL AND column_name <> 'id'
  LOOP
    EXECUTE format('ALTER TABLE admins ALTER COLUMN %I DROP NOT NULL', col.column_name);
  END LOOP;
END $$;

-- Enforce unique usernames (unique index tolerates existing NULL rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_unique ON admins(username);

-- Audit trail of admin actions (super admin oversight).
CREATE TABLE IF NOT EXISTS admin_audit (
  id             SERIAL PRIMARY KEY,
  admin_id       INTEGER,
  admin_username VARCHAR(50),
  action         VARCHAR(80),
  detail         TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);

-- Generic key/value app settings (e.g. business WhatsApp number).
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(50) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed THE single super admin (only if one doesn't already exist).
-- Username: governor   Temp password: changeme123
-- Log in, then change this password immediately (Admins tab -> My Account).
INSERT INTO admins (username, password_hash, role, permissions, active)
SELECT 'governor', crypt('changeme123', gen_salt('bf')), 'super_admin', '[]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE role = 'super_admin');
