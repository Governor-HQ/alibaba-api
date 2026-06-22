import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
function isAuthorized(req){ return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_SECRET}`; }

export async function PATCH(request, { params }) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const { id } = await params;
    const { name, phone, active, password } = await request.json();
    if (password) {
      if (password.length < 6) return NextResponse.json({ success:false, error:'Password too short.' }, { status:400 });
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE drivers SET password_hash=$1 WHERE id=$2', [hash, id]);
    }
    const r = await pool.query(
      `UPDATE drivers SET name=COALESCE($1,name), phone=COALESCE($2,phone), active=COALESCE($3,active)
       WHERE id=$4 RETURNING id, name, phone, username, active`,
      [name?.trim() ?? null, phone?.trim() ?? null, typeof active==='boolean'?active:null, id]
    );
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    return NextResponse.json({ success:true, driver:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function DELETE(request, { params }) {
  if (!isAuthorized(request)) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 });
  try {
    const { id } = await params;
    await pool.query('DELETE FROM drivers WHERE id=$1', [id]);
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
