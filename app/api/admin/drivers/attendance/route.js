// GET /api/admin/drivers/attendance?driver_id=5  — attendance log
// If driver_id omitted, returns recent attendance across all drivers (with driver name)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parsePaging, pageMeta } from '@/lib/paginate';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'attendance_view'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driver_id');
    const view = searchParams.get('view'); // 'attendance' (sign-ins) | 'activity' (rest) | null (all)
    const { page, limit, offset } = parsePaging(request);
    const conds = [];
    const filterParams = [];
    if (driverId) { filterParams.push(driverId); conds.push(`a.driver_id = $${filterParams.length}`); }
    if (view === 'attendance') conds.push(`a.action = 'signed_in'`);
    else if (view === 'activity') conds.push(`a.action <> 'signed_in'`);
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const total = (await pool.query(
      `SELECT COUNT(*)::int AS total FROM driver_attendance a ${where}`, filterParams
    )).rows[0].total;
    const result = await pool.query(
      `SELECT a.*, d.name as driver_name FROM driver_attendance a
       JOIN drivers d ON a.driver_id = d.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, limit, offset]
    );
    return NextResponse.json({ success:true, log: result.rows, ...pageMeta(total, page, limit) });
  } catch (e) {
    console.error('Admin attendance error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
