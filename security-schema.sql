-- ============================================================
-- SECURITY HARDENING — DATABASE ADDITIONS
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Backing store for the DB-backed rate limiter (lib/rate-limit.js).
CREATE TABLE IF NOT EXISTS rate_buckets (
  k      TEXT   NOT NULL,
  bucket BIGINT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (k, bucket)
);
-- Optional housekeeping: old buckets are harmless but you can clear them anytime:
--   DELETE FROM rate_buckets WHERE bucket < (extract(epoch from now())/3600 - 48);
