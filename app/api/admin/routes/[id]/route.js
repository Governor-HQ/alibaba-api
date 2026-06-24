// app/api/admin/routes/[id]/route.js
// PATCH  → update a route (price, active status, etc.)
// DELETE → remove a route

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'routes_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { origin, destination, price, duration_hours, description, active } = body;

    const result = await pool.query(
      `UPDATE routes SET
        origin = COALESCE($1, origin),
        destination = COALESCE($2, destination),
        price = COALESCE($3, price),
        duration_hours = COALESCE($4, duration_hours),
        description = COALESCE($5, description),
        active = COALESCE($6, active)
       WHERE id = $7 RETURNING *`,
      [origin, destination, price, duration_hours, description, active, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, route: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update route' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'routes_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    await pool.query('DELETE FROM routes WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Route deleted' });
  } catch (error) {
    // If trips reference this route, deletion will fail — that's intentional protection
    return NextResponse.json(
      { success: false, error: 'Cannot delete — trips exist for this route. Remove those trips first.' },
      { status: 400 }
    );
  }
}
