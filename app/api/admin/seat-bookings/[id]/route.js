// app/api/admin/seat-bookings/[id]/route.js
// PATCH /api/admin/seat-bookings/5 → update a seat booking's status (confirm/cancel)
// When cancelling, an optional cancellation_reason can be provided and is stored.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'bookings_bus'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const { status, cancellation_reason } = await request.json();

    if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    let result;
    if (status === 'cancelled') {
      result = await pool.query(
        'UPDATE seat_bookings SET status = $1, cancellation_reason = $2 WHERE id = $3 RETURNING *',
        [status, cancellation_reason?.trim() || null, id]
      );
    } else {
      result = await pool.query(
        'UPDATE seat_bookings SET status = $1, cancellation_reason = NULL WHERE id = $2 RETURNING *',
        [status, id]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking: result.rows[0] });
  } catch (error) {
    console.error('Admin seat booking update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
