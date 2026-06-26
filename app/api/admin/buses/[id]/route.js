// app/api/admin/buses/[id]/route.js
// PATCH  → update a bus
// DELETE → remove a bus

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'buses_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, plate_number, total_seats, bus_type, active, seat_map_enabled } = body;

    const result = await pool.query(
      `UPDATE buses SET
        name = COALESCE($1, name),
        plate_number = COALESCE($2, plate_number),
        total_seats = COALESCE($3, total_seats),
        bus_type = COALESCE($4, bus_type),
        active = COALESCE($5, active),
        seat_map_enabled = COALESCE($6, seat_map_enabled)
       WHERE id = $7 RETURNING *`,
      [name, plate_number, total_seats, bus_type, active,
       seat_map_enabled === undefined ? null : seat_map_enabled, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Bus not found' }, { status: 404 });
    }

    await logAdminAction(_auth.admin, 'bus_updated', `Bus #${id} ("${result.rows[0].name}") updated`);
    return NextResponse.json({ success: true, bus: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update bus' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'buses_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    await pool.query('DELETE FROM buses WHERE id = $1', [id]);
    await logAdminAction(_auth.admin, 'bus_deleted', `Bus #${id} deleted`);
    return NextResponse.json({ success: true, message: 'Bus deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete — trips exist for this bus. Remove those trips first.' },
      { status: 400 }
    );
  }
}
