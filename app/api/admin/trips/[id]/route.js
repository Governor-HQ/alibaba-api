// app/api/admin/trips/[id]/route.js
// PATCH  → update a trip (change status to cancelled/completed, reschedule)
// DELETE → remove a trip (only if no seats booked — protects existing customers)

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'trips_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { departure_date, departure_time, status, bus_id, route_id } = body;

    const result = await pool.query(
      `UPDATE trips SET
        departure_date = COALESCE($1, departure_date),
        departure_time = COALESCE($2, departure_time),
        status = COALESCE($3, status),
        bus_id = COALESCE($4, bus_id),
        route_id = COALESCE($5, route_id)
       WHERE id = $6 RETURNING *`,
      [departure_date, departure_time, status, bus_id, route_id, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 });
    }

    const _t = result.rows[0];
    await logAdminAction(_auth.admin, _t.status === 'cancelled' ? 'trip_cancelled' : 'trip_updated', `Trip #${id} ${_t.status === 'cancelled' ? 'cancelled' : 'updated'}`);
    return NextResponse.json({ success: true, trip: _t });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update trip' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'trips_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

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
    await logAdminAction(_auth.admin, 'trip_deleted', `Trip #${id} deleted`);
    return NextResponse.json({ success: true, message: 'Trip deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete trip' }, { status: 500 });
  }
}
