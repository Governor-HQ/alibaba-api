// PATCH /api/admin/charter/bookings/5  { status:'cancelled', cancellation_reason }
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction, hasPerm } from '@/lib/admin-auth';
export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'bookings_charter'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    const { status, cancellation_reason } = await request.json();
    if (!['confirmed','cancelled','pending'].includes(status)) {
      return NextResponse.json({ success:false, error:'Invalid status.' }, { status:400 });
    }

    const _cur = await pool.query('SELECT status FROM charter_bookings WHERE id = $1', [id]);
    if (!_cur.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    const _wasCancelled = _cur.rows[0].status === 'cancelled';
    const _willCancel = status === 'cancelled';
    if ((_wasCancelled || _willCancel) && !hasPerm(_auth.admin, 'bookings_cancel')) {
      return NextResponse.json({ success:false, error:'You do not have permission to cancel or undo bookings.' }, { status:403 });
    }
    let r;
    if (status === 'cancelled') {
      r = await pool.query(
        'UPDATE charter_bookings SET status=$1, cancellation_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
        [status, cancellation_reason?.trim() || null, id]
      );
    } else {
      r = await pool.query(
        'UPDATE charter_bookings SET status=$1, cancellation_reason=NULL, updated_at=NOW() WHERE id=$2 RETURNING *',
        [status, id]
      );
    }
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    await logAdminAction(_auth.admin,
      _willCancel ? 'charter_booking_cancelled' : (_wasCancelled ? 'charter_booking_restored' : 'charter_booking_' + status),
      `Booking #${id}` + (_willCancel && cancellation_reason ? ` — reason: ${cancellation_reason}` : ''));
    return NextResponse.json({ success:true, booking:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
