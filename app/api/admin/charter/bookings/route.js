import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parsePaging, pageMeta } from '@/lib/paginate';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'bookings_charter'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { page, limit, offset } = parsePaging(request);
    const stats = (await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='confirmed')::int AS confirmed FROM charter_bookings`
    )).rows[0];
    const r = await pool.query('SELECT * FROM charter_bookings ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return NextResponse.json({ success:true, bookings:r.rows, stats, ...pageMeta(stats.total, page, limit) });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
