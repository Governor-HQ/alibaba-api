import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';
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
    const zoneRes = await pool.query('SELECT name FROM charter_zones WHERE id=$1', [id]);
    if (!zoneRes.rows.length) return NextResponse.json({ success:false, error:'Zone not found.' }, { status:404 });
    // Note: charter_prices.zone_id cascades (a zone's price rows are removed with
    // it, by design); charter_bookings.zone_id is NO ACTION, so a zone that still
    // has bookings is blocked here (23503) rather than deleted.
    await pool.query('DELETE FROM charter_zones WHERE id=$1', [id]);
    await logAdminAction(_auth.admin, 'charter_zone_deleted', `Deleted charter zone '${zoneRes.rows[0].name}' (#${id})`);
    return NextResponse.json({ success:true });
  } catch (e) {
    if (e && e.code === '23503') {
      return NextResponse.json({ success:false, error:'Cannot delete — this zone still has charter bookings. Remove or reassign those bookings first.' }, { status:409 });
    }
    console.error('zone delete', e);
    return NextResponse.json({ success:false, error:'Failed to delete zone.' }, { status:500 });
  }
}
