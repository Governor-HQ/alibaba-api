-- ============================================================
-- ADMIN NUMBERING + SOFT-DELETE HISTORY
-- Run with: node scripts/run-sql.mjs admin-numbering-schema.sql
-- Safe to re-run. NON-DESTRUCTIVE: only ADDs columns, backfills numbers, and
-- creates a sequence/index/trigger. No DELETE, no TRUNCATE, no overwrite of
-- existing admin data (username, password_hash, role, permissions, active are
-- never touched).
-- ============================================================

-- Permanent, sequential number per admin. Assigned ONCE at creation, never
-- reused, never recalculated. Super admin stays NULL (never numbered).
ALTER TABLE admins ADD COLUMN IF NOT EXISTS admin_number INTEGER;

-- Soft-delete marker. NULL = still around (active or suspended). A timestamp =
-- deleted, but the row is kept forever for backtracking (never physically removed).
ALTER TABLE admins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- The permanent counter. Sequences never go backwards, so numbers are never
-- reused even after a soft-delete.
CREATE SEQUENCE IF NOT EXISTS admin_number_seq;

-- Backfill existing NON-super-admin rows deterministically by created_at (then
-- id as a tiebreaker) — explicit ordering, NOT reliant on any implicit order.
-- The + COALESCE(MAX(admin_number),0) offset makes this safe to re-run and never
-- collide with numbers already assigned.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM admins
  WHERE COALESCE(role, 'admin') <> 'super_admin' AND admin_number IS NULL
)
UPDATE admins a
SET admin_number = o.rn + COALESCE((SELECT MAX(admin_number) FROM admins), 0)
FROM ordered o
WHERE a.id = o.id;

-- Integrity: no two admins may share a number. Partial index allows many NULLs
-- (super admin, and any future edge case) while keeping assigned numbers unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_admin_number
  ON admins(admin_number) WHERE admin_number IS NOT NULL;

-- Advance the sequence PAST the highest number now in use, so the next NEW admin
-- continues cleanly. If no admin is numbered yet, nextval starts at 1.
SELECT setval(
  'admin_number_seq',
  COALESCE((SELECT MAX(admin_number) FROM admins), 1),
  (SELECT MAX(admin_number) IS NOT NULL FROM admins)
);

-- The going-forward mechanism: a BEFORE INSERT trigger assigns the next number
-- automatically to every new non-super-admin. Runs on ANY insert path, and can
-- never number the super admin.
CREATE OR REPLACE FUNCTION assign_admin_number() RETURNS trigger AS $$
BEGIN
  IF COALESCE(NEW.role, 'admin') <> 'super_admin' AND NEW.admin_number IS NULL THEN
    NEW.admin_number := nextval('admin_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_admin_number ON admins;
CREATE TRIGGER trg_assign_admin_number
  BEFORE INSERT ON admins
  FOR EACH ROW EXECUTE FUNCTION assign_admin_number();
