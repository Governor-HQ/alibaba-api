// POST /api/admin/change-password { current_password, new_password }
// Lets ANY signed-in admin (including the super admin) change their own password.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function POST(request) {
  const a = await requireAdmin(request);
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { current_password, new_password } = await request.json();
    if (!current_password || !new_password) return NextResponse.json({ success:false, error:'Current and new password required.' }, { status:400 });
    if (new_password.length < 6) return NextResponse.json({ success:false, error:'New password must be at least 6 characters.' }, { status:400 });
    const r = await pool.query('SELECT password_hash FROM admins WHERE id=$1', [a.admin.adminId]);
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    const ok = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!ok) return NextResponse.json({ success:false, error:'Current password is incorrect.' }, { status:401 });
    await pool.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(new_password, 10), a.admin.adminId]);
    await logAdminAction(a.admin, 'change_password', 'Changed own password');
    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('change-password', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
