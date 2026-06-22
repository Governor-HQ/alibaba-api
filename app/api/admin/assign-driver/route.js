// POST /api/admin/assign-driver { kind:'interstate'|'charter', id, driver_id }
// Assigns (or clears, if driver_id null) a driver to a trip or charter booking.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
function isAuthorized(req){ return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`; }

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
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
