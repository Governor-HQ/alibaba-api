// PATCH /api/admin/charter/bookings/5  { status:'cancelled', cancellation_reason }
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'bookings_charter'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    const { status, cancellation_reason } = await request.json();
    if (!['confirmed','cancelled','pending'].includes(status)) {
      return NextResponse.json({ success:false, error:'Invalid status.' }, { status:400 });
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
    return NextResponse.json({ success:true, booking:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
