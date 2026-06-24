// POST /api/admin/login { username, password } → admin JWT
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logAdminAction } from '@/lib/admin-auth';
const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) return NextResponse.json({ success:false, error:'Username and password required.' }, { status:400 });
    const r = await pool.query('SELECT * FROM admins WHERE username = $1', [username.toLowerCase().trim()]);
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Invalid username or password.' }, { status:401 });
    const a = r.rows[0];
    const ok = await bcrypt.compare(password, a.password_hash);
    if (!ok) return NextResponse.json({ success:false, error:'Invalid username or password.' }, { status:401 });
    if (a.active === false) return NextResponse.json({ success:false, error:'Your admin account has been suspended.' }, { status:403 });
    const perms = Array.isArray(a.permissions) ? a.permissions : (a.permissions || []);
    const token = jwt.sign(
      { adminId:a.id, username:a.username, role:'admin_user', adminRole:a.role, permissions:perms },
      JWT_SECRET, { expiresIn:'2d' }
    );
    await logAdminAction({ adminId:a.id, username:a.username }, 'login', null);
    return NextResponse.json({ success:true, token, admin:{ id:a.id, username:a.username, role:a.role, permissions:perms } });
  } catch (e) {
    console.error('admin login', e);
    return NextResponse.json({ success:false, error:'Something went wrong.' }, { status:500 });
  }
}
