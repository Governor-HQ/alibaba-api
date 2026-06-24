import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'bookings_charter'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const r = await pool.query('SELECT * FROM charter_bookings ORDER BY created_at DESC');
    return NextResponse.json({ success:true, bookings:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
