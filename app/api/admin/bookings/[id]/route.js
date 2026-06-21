// app/api/admin/bookings/[id]/route.js
//
// PATCH /api/admin/bookings/5 → update booking status (confirm or cancel)
// When cancelling, an optional cancellation_reason can be provided and is stored.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

function isAuthorized(request) {
  const token = request.headers.get('authorization');
  return token === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function PATCH(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status, cancellation_reason } = await request.json(); // 'confirmed' | 'cancelled' | 'pending'

    if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    let result;
    if (status === 'cancelled') {
      // Store the reason (may be null/empty if admin didn't type one)
      result = await pool.query(
        'UPDATE bookings SET status = $1, cancellation_reason = $2 WHERE id = $3 RETURNING *',
        [status, cancellation_reason?.trim() || null, id]
      );
    } else {
      // Clear any old reason when re-confirming or setting back to pending
      result = await pool.query(
        'UPDATE bookings SET status = $1, cancellation_reason = NULL WHERE id = $2 RETURNING *',
        [status, id]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking: result.rows[0] });

  } catch (error) {
    console.error('Admin booking update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
