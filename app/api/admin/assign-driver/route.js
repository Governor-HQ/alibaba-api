// POST /api/admin/assign-driver { kind:'interstate'|'charter', id, driver_id }
// Assigns (or clears, if driver_id null) a driver to a trip or charter booking.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function POST(request) {
  const _auth = await requireAdmin(request, 'drivers_assign'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { kind, id, driver_id } = await request.json();
    const drv = driver_id || null;
    if (kind === 'interstate') {
      const r = await pool.query('UPDATE trips SET driver_id=$1 WHERE id=$2 RETURNING id', [drv, id]);
      if (!r.rows.length) return NextResponse.json({ success:false, error:'Trip not found.' }, { status:404 });
    } else if (kind === 'charter') {
      const r = await pool.query('UPDATE charter_bookings SET driver_id=$1, updated_at=NOW() WHERE id=$2 RETURNING id', [drv, id]);
      if (!r.rows.length) return NextResponse.json({ success:false, error:'Charter not found.' }, { status:404 });
    } else {
      return NextResponse.json({ success:false, error:'Invalid kind.' }, { status:400 });
    }
    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('Assign driver error:', e);
    return NextResponse.json({ success:false, error:'Failed to assign.' }, { status:500 });
  }
}
