// lib/seat-holds.js
// Lazy, cron-free reconciliation for abandoned bus seat holds.
//
// When a hold expires without ever being paid/confirmed, hold_expires_at is a
// past timestamp that is still non-null (paid / receipt-uploaded bookings clear
// it to NULL). That leaves a stale 'pending' row which never resolves on its own,
// so the admin Bus Seat Bookings list fills with rows that look active forever
// even though the seat is already free again.
//
// expireStaleHolds() is called at the start of seat-booking read paths and flips
// those rows to 'cancelled', making stored status eventually consistent with
// reality — no cron. The existing "treat expired holds as free" availability
// filters stay in place as a safety net for any read path that hasn't run this
// write-back yet; the two are designed to coexist.
import pool from '@/lib/db';

export async function expireStaleHolds() {
  try {
    const r = await pool.query(
      `UPDATE seat_bookings
         SET status = 'cancelled',
             cancellation_reason = COALESCE(cancellation_reason, 'Hold expired — seat released automatically')
       WHERE hold_expires_at IS NOT NULL
         AND hold_expires_at < NOW()
         AND status NOT IN ('confirmed', 'cancelled')
         AND COALESCE(payment_status, '') <> 'paid'`
    );
    return r.rowCount || 0;
  } catch (e) {
    // Reconciliation must never break the read it precedes — swallow and move on.
    console.error('expireStaleHolds failed', e);
    return 0;
  }
}
