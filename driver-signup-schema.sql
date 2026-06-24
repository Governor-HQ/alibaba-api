-- ============================================================
-- DRIVER SELF-SIGNUP + APPROVAL — DATABASE ADDITIONS
-- Paste the SQL below into the Supabase SQL editor (NOT the filename).
-- Safe to re-run: uses IF NOT EXISTS and a guarded seed.
-- ============================================================

-- Lifecycle status for drivers: 'pending' (awaiting approval), 'approved', 'suspended'.
-- The DEFAULT 'approved' blesses all EXISTING drivers automatically when the
-- column is added. New self-signups are inserted as 'pending' explicitly by the API.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';

-- Shared, rotatable invite code that gates driver self-signup.
CREATE TABLE IF NOT EXISTS driver_settings (
  id          SERIAL PRIMARY KEY,
  invite_code VARCHAR(20) NOT NULL,
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Seed one invite code if none exists yet.
INSERT INTO driver_settings (invite_code)
SELECT 'DRIVE-' || upper(substring(md5(random()::text) for 6))
WHERE NOT EXISTS (SELECT 1 FROM driver_settings);
