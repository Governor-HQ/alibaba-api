import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const r = await pool.query('SELECT * FROM charter_vehicle_types ORDER BY sort_order ASC, capacity ASC');
    return NextResponse.json({ success:true, vehicle_types:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { name, capacity, guide_text } = await request.json();
    if (!name || !capacity) return NextResponse.json({ success:false, error:'Name and capacity required.' }, { status:400 });
    const r = await pool.query(
      'INSERT INTO charter_vehicle_types (name, capacity, guide_text) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), capacity, guide_text?.trim() || null]
    );
    return NextResponse.json({ success:true, vehicle_type:r.rows[0] }, { status:201 });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
