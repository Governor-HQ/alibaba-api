// app/api/admin/bookings/[id]/route.js
//
// PATCH /api/admin/bookings/5 → update booking status (confirm or cancel)
// When cancelling, an optional cancellation_reason can be provided and is stored.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction, hasPerm } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'bookings_car'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const { status, cancellation_reason } = await request.json(); // 'confirmed' | 'cancelled' | 'pending'

    if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // Cancelling — or undoing a cancellation — is gated behind the bookings_cancel permission.
    const _cur = await pool.query('SELECT status FROM bookings WHERE id = $1', [id]);
    if (_cur.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    const _wasCancelled = _cur.rows[0].status === 'cancelled';
    const _willCancel = status === 'cancelled';
    if ((_wasCancelled || _willCancel) && !hasPerm(_auth.admin, 'bookings_cancel')) {
      return NextResponse.json({ success: false, error: 'You do not have permission to cancel or undo bookings.' }, { status: 403 });
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

    await logAdminAction(_auth.admin,
      _willCancel ? 'car_booking_cancelled' : (_wasCancelled ? 'car_booking_restored' : 'car_booking_' + status),
      `Booking #${id}` + (_willCancel && cancellation_reason ? ` — reason: ${cancellation_reason}` : ''));
    return NextResponse.json({ success: true, booking: result.rows[0] });

  } catch (error) {
    console.error('Admin booking update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
