// app/api/admin/buses/[id]/route.js
// PATCH  → update a bus
// DELETE → remove a bus

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function PATCH(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, plate_number, total_seats, bus_type, active } = body;

    const result = await pool.query(
      `UPDATE buses SET
        name = COALESCE($1, name),
        plate_number = COALESCE($2, plate_number),
        total_seats = COALESCE($3, total_seats),
        bus_type = COALESCE($4, bus_type),
        active = COALESCE($5, active)
       WHERE id = $6 RETURNING *`,
      [name, plate_number, total_seats, bus_type, active, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Bus not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, bus: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update bus' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await pool.query('DELETE FROM buses WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Bus deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete — trips exist for this bus. Remove those trips first.' },
      { status: 400 }
    );
  }
}
