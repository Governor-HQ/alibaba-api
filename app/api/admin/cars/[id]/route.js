// app/api/admin/cars/[id]/route.js
//
// PATCH /api/admin/cars/3  → update car with ID 3
// DELETE /api/admin/cars/3 → delete car with ID 3

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// UPDATE a car
export async function PATCH(request, { params }) {
  const _auth = await requireAdmin(request, 'cars_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, model, year, category, seats, price_day, description, features, image_url, available } = body;

    const result = await pool.query(
      `UPDATE cars SET
        name = COALESCE($1, name),
        model = COALESCE($2, model),
        year = COALESCE($3, year),
        category = COALESCE($4, category),
        seats = COALESCE($5, seats),
        price_day = COALESCE($6, price_day),
        description = COALESCE($7, description),
        features = COALESCE($8, features),
        image_url = COALESCE($9, image_url),
        available = COALESCE($10, available)
       WHERE id = $11
       RETURNING *`,
      [name, model, year, category, seats, price_day, description, features, image_url, available, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Car not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, car: result.rows[0] });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update car' }, { status: 500 });
  }
}

// DELETE a car
export async function DELETE(request, { params }) {
  const _auth = await requireAdmin(request, 'cars_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const { id } = await params;
    await pool.query('DELETE FROM cars WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Car deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete car' }, { status: 500 });
  }
}