// POST /api/driver/attendance { action:'signed_in', note? } — sign attendance (once/day for sign-in)
// GET  /api/driver/attendance — driver's own attendance log + whether signed in today
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function POST(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const { action, note, trip_kind, trip_ref } = await request.json();
    const act = action || 'signed_in';

    // Enforce once-per-day for daily sign-in
    if (act === 'signed_in') {
      const today = await pool.query(
        `SELECT id FROM driver_attendance
         WHERE driver_id = $1 AND action = 'signed_in'
           AND created_at::date = CURRENT_DATE`,
        [d.driverId]
      );
      if (today.rows.length > 0) {
        return NextResponse.json({ success:false, error:'You already signed attendance today.', already_signed:true }, { status:409 });
      }
    }

    await pool.query(
      'INSERT INTO driver_attendance (driver_id, trip_kind, trip_ref, action, note) VALUES ($1,$2,$3,$4,$5)',
      [d.driverId, trip_kind || null, trip_ref || null, act, note || null]
    );
    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('Attendance error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}

export async function GET(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const log = await pool.query(
      'SELECT * FROM driver_attendance WHERE driver_id=$1 ORDER BY created_at DESC LIMIT 50', [d.driverId]);
    const today = await pool.query(
      `SELECT id FROM driver_attendance
       WHERE driver_id=$1 AND action='signed_in' AND created_at::date = CURRENT_DATE`, [d.driverId]);
    return NextResponse.json({ success:true, log: log.rows, signed_in_today: today.rows.length > 0 });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
