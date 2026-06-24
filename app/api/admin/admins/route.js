// /api/admin/admins  GET: list admins · POST: create a normal admin (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function GET(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const r = await pool.query('SELECT id, username, role, permissions, active, created_at FROM admins ORDER BY (role=\'super_admin\') DESC, created_at ASC');
  return NextResponse.json({ success:true, admins:r.rows });
}

export async function POST(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { username, password, permissions } = await request.json();
    if (!username || !password) return NextResponse.json({ success:false, error:'Username and password required.' }, { status:400 });
    if (password.length < 6) return NextResponse.json({ success:false, error:'Password must be at least 6 characters.' }, { status:400 });
    const uname = username.toLowerCase().trim();
    const exists = await pool.query('SELECT id FROM admins WHERE username = $1', [uname]);
    if (exists.rows.length) return NextResponse.json({ success:false, error:'Username already taken.' }, { status:409 });
    const perms = Array.isArray(permissions) ? permissions : [];
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO admins (username, password_hash, role, permissions, active, created_by) VALUES ($1,$2,$3,$4::jsonb,true,$5) RETURNING id, username, role, permissions, active',
      [uname, hash, 'admin', JSON.stringify(perms), a.admin.adminId]
    );
    await logAdminAction(a.admin, 'create_admin', `Created admin '${uname}'`);
    return NextResponse.json({ success:true, admin:r.rows[0] }, { status:201 });
  } catch (e) {
    console.error('create admin', e);
    return NextResponse.json({ success:false, error:'Failed to create admin.' }, { status:500 });
  }
}
