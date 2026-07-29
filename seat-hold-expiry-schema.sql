-- ============================================================
-- TIMED-HOLD EXPIRY FOR INTERSTATE BUS SEAT BOOKINGS
-- Paste into the Supabase SQL editor. Safe to re-run. NON-DESTRUCTIVE:
-- only ADDs a nullable column and SEEDs settings — no drops, no data loss.
-- Scope: seat_bookings only (car/charter rentals share the issue but are
-- out of scope for this pass).
-- ============================================================

-- A pending seat hold that is never paid must free itself. hold_expires_at is
-- the wall-clock time this hold lapses; a seat with hold_expires_at in the past
-- is treated as FREE at query time (lazy expiry — no cron/background job).
-- NULL means "does not expire": the booking is paid/confirmed, or a transfer
-- receipt was uploaded and it's awaiting a manual admin decision.
ALTER TABLE seat_bookings ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMP;

-- Admin-configurable hold windows (minutes). Defaults: 15 min for online
-- (Paystack) so an abandoned card checkout frees the seat quickly; 180 min for
-- bank transfer so the customer has time to send money and upload the receipt.
INSERT INTO app_settings (key, value) VALUES
  ('seat_hold_online_minutes', '15'),
  ('seat_hold_transfer_minutes', '180')
ON CONFLICT (key) DO NOTHING;

-- TODO(out-of-scope): bookings (car) and charter_bookings share this abandoned-
-- hold problem; extend the same hold_expires_at column + lazy filtering to them.
-- TODO(out-of-scope): all expiry is lazy (evaluated at query time); no cron job
-- physically deletes lapsed rows — add one only if row bloat ever becomes real.
