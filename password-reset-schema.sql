-- ============================================================
-- PASSWORD RESET — DATABASE ADDITION
-- Run this in your Supabase SQL editor (paste the SQL below, NOT the filename)
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_resets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        VARCHAR(12) NOT NULL,   -- interim: stored as plaintext so the team can relay it via WhatsApp.
                                       -- When automated email is live, email the code instead and stop storing plaintext.
  expires_at  TIMESTAMP NOT NULL,
  used        BOOLEAN DEFAULT false,
  attempts    INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user   ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_active ON password_resets(user_id, used, expires_at);
