import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    const { name, description, active } = await request.json();
    const r = await pool.query(
      `UPDATE charter_zones SET name=COALESCE($1,name), description=COALESCE($2,description),
       active=COALESCE($3,active) WHERE id=$4 RETURNING *`,
      [name?.trim() ?? null, description?.trim() ?? null, typeof active==='boolean'?active:null, id]
    );
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    return NextResponse.json({ success:true, zone:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const { id } = await params;
    await pool.query('DELETE FROM charter_zones WHERE id=$1', [id]);
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
