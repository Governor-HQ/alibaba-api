// app/api/user/bookings/route.js
// GET /api/user/bookings — all bookings (car + bus) for the logged-in user.
// Runs a lazy-expiry sweep first so statuses are always accurate.
// Matches by user_id OR customer_email.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { expireUserPendingBookings } from '@/lib/expiry';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
  } catch {
    return null;
  }
}

export async function GET(request) {
  const tokenUser = getUserFromToken(request);
  if (!tokenUser) {
    return NextResponse.json({ success: false, error: 'Please log in to view bookings.' }, { status: 401 });
  }

  try {
    const userRow = await pool.query('SELECT id, email FROM users WHERE id = $1', [tokenUser.userId]);
    if (userRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
    const userId = userRow.rows[0].id;
    const userEmail = userRow.rows[0].email;

    // Lazy expiry: mark any stale pending bookings as expired before reading
    await expireUserPendingBookings(userId, userEmail);

    const carBookings = await pool.query(
      `SELECT b.*, c.name as car_name, c.model as car_model, c.image_url,
              'car' as booking_type
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       WHERE b.user_id = $1 OR LOWER(b.customer_email) = LOWER($2)
       ORDER BY b.created_at DESC`,
      [userId, userEmail]
    );

    const busBookings = await pool.query(
      `SELECT sb.*, r.origin, r.destination, b.name as bus_name,
              t.departure_date, t.departure_time,
              'bus' as booking_type
       FROM seat_bookings sb
       JOIN trips t ON sb.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       WHERE sb.user_id = $1 OR LOWER(sb.customer_email) = LOWER($2)
       ORDER BY sb.created_at DESC`,
      [userId, userEmail]
    );

    return NextResponse.json({
      success: true,
      car_bookings: carBookings.rows,
      bus_bookings: busBookings.rows
    });

  } catch (error) {
    console.error('User bookings error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings.' }, { status: 500 });
  }
}
