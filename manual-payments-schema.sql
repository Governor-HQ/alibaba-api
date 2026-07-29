-- ============================================================
-- MANUAL (BANK TRANSFER) PAYMENTS — DATABASE ADDITIONS
-- Paste into the Supabase SQL editor. Safe to re-run.
-- Prereq: create a PRIVATE Storage bucket named exactly  receipts
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_payments (
  id            SERIAL PRIMARY KEY,
  booking_type  VARCHAR(10) NOT NULL,                 -- 'car' | 'bus' | 'charter'
  reference     VARCHAR(80) NOT NULL,                 -- the booking's payment_reference
  amount        NUMERIC(12,2),
  sender_name   VARCHAR(120),
  receipt_path  TEXT,                                 -- object path in the 'receipts' bucket
  status        VARCHAR(20) DEFAULT 'pending',        -- pending | confirmed | rejected
  created_at    TIMESTAMP DEFAULT NOW(),
  confirmed_by  VARCHAR(50),
  confirmed_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON manual_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_payments_ref ON manual_payments(reference);

-- Bank-detail settings (shown to customers on the transfer page; edited in admin).
INSERT INTO app_settings (key, value) VALUES
  ('bank_name', ''),
  ('bank_account_number', ''),
  ('bank_account_name', '')
ON CONFLICT (key) DO NOTHING;
