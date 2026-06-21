// app/api/admin/trips/[id]/route.js
// PATCH  → update a trip (change status to cancelled/completed, reschedule)
// DELETE → remove a trip (only if no seats booked — protects existing customers)

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function PATCH(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { departure_date, departure_time, status, bus_id } = body;

    const result = await pool.query(
      `UPDATE trips SET
        departure_date = COALESCE($1, departure_date),
        departure_time = COALESCE($2, departure_time),
        status = COALESCE($3, status),
        bus_id = COALESCE($4, bus_id)
       WHERE id = $5 RETURNING *`,
      [departure_date, departure_time, status, bus_id, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, trip: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update trip' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Protect customers — don't allow deleting a trip that already has bookings
    const existingBookings = await pool.query(
      `SELECT id FROM seat_bookings WHERE trip_id = $1 AND status != 'cancelled'`,
      [id]
    );

    if (existingBookings.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete — this trip has active bookings. Cancel the trip instead.' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM trips WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Trip deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete trip' }, { status: 500 });
  }
}
