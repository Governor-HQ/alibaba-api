// GET  /api/admin/drivers — list all drivers
// POST /api/admin/drivers — create a driver { name, phone, username, password }
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
function isAuthorized(req){ return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`; }

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const r = await pool.query('SELECT id, name, phone, username, active, created_at FROM drivers ORDER BY created_at DESC');
    return NextResponse.json({ success:true, drivers:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const { name, phone, username, password } = await request.json();
    if (!name || !phone || !username || !password) {
      return NextResponse.json({ success:false, error:'All fields are required.' }, { status:400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success:false, error:'Password must be at least 6 characters.' }, { status:400 });
    }
    const exists = await pool.query('SELECT id FROM drivers WHERE username = $1', [username.toLowerCase().trim()]);
    if (exists.rows.length) {
      return NextResponse.json({ success:false, error:'Username already taken.' }, { status:409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO drivers (name, phone, username, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, phone, username, active',
      [name.trim(), phone.trim(), username.toLowerCase().trim(), hash]
    );
    return NextResponse.json({ success:true, driver:r.rows[0] }, { status:201 });
  } catch (e) {
    console.error('Create driver error:', e);
    return NextResponse.json({ success:false, error:'Failed to create driver.' }, { status:500 });
  }
}
