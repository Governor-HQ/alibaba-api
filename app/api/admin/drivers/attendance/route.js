// GET /api/admin/drivers/attendance?driver_id=5  — attendance log
// If driver_id omitted, returns recent attendance across all drivers (with driver name)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
function isAuthorized(req){ return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`; }

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driver_id');
    let result;
    if (driverId) {
      result = await pool.query(
        `SELECT a.*, d.name as driver_name FROM driver_attendance a
         JOIN drivers d ON a.driver_id = d.id
         WHERE a.driver_id = $1 ORDER BY a.created_at DESC LIMIT 200`,
        [driverId]
      );
    } else {
      result = await pool.query(
        `SELECT a.*, d.name as driver_name FROM driver_attendance a
         JOIN drivers d ON a.driver_id = d.id
         ORDER BY a.created_at DESC LIMIT 200`
      );
    }
    return NextResponse.json({ success:true, log: result.rows });
  } catch (e) {
    console.error('Admin attendance error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
