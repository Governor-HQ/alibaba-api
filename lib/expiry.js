// lib/expiry.js
// Lazy-expiry helpers. Called whenever bookings are read, so statuses are
// always accurate without needing a background cron job.
//
// A PENDING booking becomes 'expired' if ANY of these are true:
//   1. The trip departure / car pickup datetime has already passed
//   2. The seat is already taken by a CONFIRMED booking (bus),
//      or the car is booked out for those dates (car)
//   3. The booking has been pending for more than 24 hours

import pool from '@/lib/db';

const PENDING_LIMIT_HOURS = 24;

// Sweep a single user's pending bookings and mark expired ones.
// Safe to call on every bookings read. Returns nothing meaningful.
export async function expireUserPendingBookings(userId, email) {
  try {
    // ── BUS seat bookings ──
    // Expire if: trip departed, OR pending > 24h, OR seat confirmed by someone else
    await pool.query(
      `UPDATE seat_bookings sb
         SET status = 'expired'
       FROM trips t
       WHERE sb.trip_id = t.id
         AND sb.status = 'pending'
         AND (sb.user_id = $1 OR LOWER(sb.customer_email) = LOWER($2))
         AND (
              (t.departure_date + COALESCE(t.departure_time, '00:00')) < NOW()
              OR sb.created_at < NOW() - INTERVAL '${PENDING_LIMIT_HOURS} hours'
              OR EXISTS (
                   SELECT 1 FROM seat_bookings other
                   WHERE other.trip_id = sb.trip_id
                     AND other.seat_number = sb.seat_number
                     AND other.status = 'confirmed'
                     AND other.id <> sb.id
                 )
            )`,
      [userId, email]
    );

    // ── CAR bookings ──
    // Expire if: pickup date passed, OR pending > 24h, OR car confirmed-booked for overlapping dates
    await pool.query(
      `UPDATE bookings b
         SET status = 'expired'
       WHERE b.status = 'pending'
         AND (b.user_id = $1 OR LOWER(b.customer_email) = LOWER($2))
         AND (
              b.pickup_date < CURRENT_DATE
              OR b.created_at < NOW() - INTERVAL '${PENDING_LIMIT_HOURS} hours'
              OR EXISTS (
                   SELECT 1 FROM bookings other
                   WHERE other.car_id = b.car_id
                     AND other.status = 'confirmed'
                     AND other.id <> b.id
                     AND other.pickup_date <= b.return_date
                     AND other.return_date >= b.pickup_date
                 )
            )`,
      [userId, email]
    );
  } catch (err) {
    // Non-fatal: if expiry sweep fails, we still return whatever bookings exist
    console.error('Expiry sweep error:', err);
  }
}

// Check ONE booking by reference. Marks it expired if needed, then returns
// the up-to-date row. type = 'car' | 'bus'. Returns null if not found.
export async function checkAndGetBooking(reference, type) {
  if (type === 'bus') {
    // Mark expired if applicable
    await pool.query(
      `UPDATE seat_bookings sb
         SET status = 'expired'
       FROM trips t
       WHERE sb.trip_id = t.id
         AND sb.payment_reference = $1
         AND sb.status = 'pending'
         AND (
              (t.departure_date + COALESCE(t.departure_time, '00:00')) < NOW()
              OR sb.created_at < NOW() - INTERVAL '${PENDING_LIMIT_HOURS} hours'
              OR EXISTS (
                   SELECT 1 FROM seat_bookings other
                   WHERE other.trip_id = sb.trip_id
                     AND other.seat_number = sb.seat_number
                     AND other.status = 'confirmed'
                     AND other.id <> sb.id
                 )
            )`,
      [reference]
    );

    const res = await pool.query(
      `SELECT sb.*, r.origin, r.destination, b.name as bus_name,
              t.departure_date, t.departure_time, 'bus' as booking_type
       FROM seat_bookings sb
       JOIN trips t ON sb.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       WHERE sb.payment_reference = $1`,
      [reference]
    );
    return res.rows[0] || null;
  } else {
    await pool.query(
      `UPDATE bookings b
         SET status = 'expired'
       WHERE b.payment_reference = $1
         AND b.status = 'pending'
         AND (
              b.pickup_date < CURRENT_DATE
              OR b.created_at < NOW() - INTERVAL '${PENDING_LIMIT_HOURS} hours'
              OR EXISTS (
                   SELECT 1 FROM bookings other
                   WHERE other.car_id = b.car_id
                     AND other.status = 'confirmed'
                     AND other.id <> b.id
                     AND other.pickup_date <= b.return_date
                     AND other.return_date >= b.pickup_date
                 )
            )`,
      [reference]
    );

    const res = await pool.query(
      `SELECT b.*, c.name as car_name, c.model as car_model, c.image_url, 'car' as booking_type
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       WHERE b.payment_reference = $1`,
      [reference]
    );
    return res.rows[0] || null;
  }
}
