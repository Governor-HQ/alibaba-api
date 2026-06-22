// POST /api/driver/attendance { action:'signed_in', note? }
// GET  /api/driver/attendance — driver's own recent attendance log
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function POST(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const { action, note, trip_kind, trip_ref } = await request.json();
    await pool.query(
      'INSERT INTO driver_attendance (driver_id, trip_kind, trip_ref, action, note) VALUES ($1,$2,$3,$4,$5)',
      [d.driverId, trip_kind || null, trip_ref || null, action || 'signed_in', note || null]
    );
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function GET(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const r = await pool.query(
      'SELECT * FROM driver_attendance WHERE driver_id=$1 ORDER BY created_at DESC LIMIT 30', [d.driverId]);
    return NextResponse.json({ success:true, log:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
