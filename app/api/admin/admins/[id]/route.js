// /api/admin/admins/[id]  PATCH: permissions/active/password · DELETE (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { id } = await params;
    const target = await pool.query('SELECT id, role, deleted_at FROM admins WHERE id = $1', [id]);
    if (!target.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    if (target.rows[0].deleted_at) return NextResponse.json({ success:false, error:'This admin has been deleted.' }, { status:404 });
    if (target.rows[0].role === 'super_admin') return NextResponse.json({ success:false, error:'The super admin account cannot be modified here.' }, { status:403 });

    const { permissions, active, password } = await request.json();
    if (password) {
      if (password.length < 6) return NextResponse.json({ success:false, error:'Password too short.' }, { status:400 });
      await pool.query('UPDATE admins SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 10), id]);
    }
    const permsVal = Array.isArray(permissions) ? JSON.stringify(permissions) : null;
    const r = await pool.query(
      'UPDATE admins SET permissions=COALESCE($1::jsonb,permissions), active=COALESCE($2,active) WHERE id=$3 RETURNING id, username, role, permissions, active',
      [permsVal, typeof active === 'boolean' ? active : null, id]
    );
    await logAdminAction(a.admin, 'update_admin', `Updated admin #${id}`);
    return NextResponse.json({ success:true, admin:r.rows[0] });
  } catch (e) {
    console.error('patch admin', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}

export async function DELETE(request, { params }) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { id } = await params;
    const target = await pool.query('SELECT role, username, deleted_at FROM admins WHERE id = $1', [id]);
    if (!target.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    if (target.rows[0].role === 'super_admin') return NextResponse.json({ success:false, error:'The super admin cannot be deleted.' }, { status:403 });
    if (target.rows[0].deleted_at) return NextResponse.json({ success:false, error:'This admin is already deleted.' }, { status:409 });
    // Soft delete — keep the row forever for backtracking; the admin can no longer
    // log in (see login route + requireAdmin, both block deleted_at).
    await pool.query('UPDATE admins SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id]);
    await logAdminAction(a.admin, 'delete_admin', `Soft-deleted admin '${target.rows[0].username}' (#${id})`);
    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('delete admin', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
