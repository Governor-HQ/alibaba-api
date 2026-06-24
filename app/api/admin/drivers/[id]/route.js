import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import bcrypt from 'bcryptjs';
export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'drivers_approve'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    const { name, phone, active, password, status } = await request.json();
    if (password) {
      if (password.length < 6) return NextResponse.json({ success:false, error:'Password too short.' }, { status:400 });
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE drivers SET password_hash=$1 WHERE id=$2', [hash, id]);
    }

    // A status change drives the `active` flag: approved → active, otherwise inactive.
    let activeVal = typeof active === 'boolean' ? active : null;
    let statusVal = null;
    if (status && ['pending','approved','suspended'].includes(status)) {
      statusVal = status;
      activeVal = (status === 'approved');
    }

    const r = await pool.query(
      `UPDATE drivers SET
         name=COALESCE($1,name),
         phone=COALESCE($2,phone),
         active=COALESCE($3,active),
         status=COALESCE($4,status)
       WHERE id=$5 RETURNING id, name, phone, username, active, status`,
      [name?.trim() ?? null, phone?.trim() ?? null, activeVal, statusVal, id]
    );
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    return NextResponse.json({ success:true, driver:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'drivers_approve'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    await pool.query('DELETE FROM drivers WHERE id=$1', [id]);
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
