import pool from '@/lib/db';
import { NextResponse } from 'next/server';
function isAuthorized(req){ return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`; }

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const r = await pool.query('SELECT * FROM charter_zones ORDER BY name ASC');
    return NextResponse.json({ success:true, zones:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const { name, description } = await request.json();
    if (!name) return NextResponse.json({ success:false, error:'Name required.' }, { status:400 });
    const r = await pool.query(
      'INSERT INTO charter_zones (name, description) VALUES ($1,$2) RETURNING *',
      [name.trim(), description?.trim() || null]
    );
    return NextResponse.json({ success:true, zone:r.rows[0] }, { status:201 });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
