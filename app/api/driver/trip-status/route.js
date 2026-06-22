// POST /api/driver/trip-status { kind:'interstate'|'charter', id, status }
// status: 'arrived' | 'departed' | 'completed'
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

const VALID = ['scheduled','arrived','departed','completed','cancelled'];

export async function POST(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const { kind, id, status } = await request.json();
    if (!VALID.includes(status)) return NextResponse.json({ success:false, error:'Invalid status.' }, { status:400 });

    if (kind === 'interstate') {
      const own = await pool.query('SELECT driver_id FROM trips WHERE id=$1', [id]);
      if (!own.rows.length) return NextResponse.json({ success:false, error:'Trip not found.' }, { status:404 });
      if (own.rows[0].driver_id !== d.driverId) return NextResponse.json({ success:false, error:'Not your trip.' }, { status:403 });
      await pool.query('UPDATE trips SET trip_status=$1 WHERE id=$2', [status, id]);
    } else if (kind === 'charter') {
      const own = await pool.query('SELECT driver_id FROM charter_bookings WHERE id=$1', [id]);
      if (!own.rows.length) return NextResponse.json({ success:false, error:'Charter not found.' }, { status:404 });
      if (own.rows[0].driver_id !== d.driverId) return NextResponse.json({ success:false, error:'Not your charter.' }, { status:403 });
      await pool.query('UPDATE charter_bookings SET trip_status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    } else {
      return NextResponse.json({ success:false, error:'Invalid kind.' }, { status:400 });
    }

    // Log attendance action
    await pool.query(
      'INSERT INTO driver_attendance (driver_id, trip_kind, trip_ref, action) VALUES ($1,$2,$3,$4)',
      [d.driverId, kind, String(id), status]
    );
    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('Trip status error:', e);
    return NextResponse.json({ success:false, error:'Failed to update.' }, { status:500 });
  }
}
