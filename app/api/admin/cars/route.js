// app/api/admin/cars/route.js
//
// This is the admin-only endpoint for managing cars.
// POST → add a new car to the fleet
// All admin routes will eventually require a login token

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// Simple token check — we'll tighten this with full auth later
// GET all cars including unavailable ones (admin sees everything)
export async function GET(request) {
  const _auth = await requireAdmin(request, 'cars_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  const result = await pool.query('SELECT * FROM cars ORDER BY created_at DESC');
  return NextResponse.json({ success: true, cars: result.rows });
}

// POST — add a new car
export async function POST(request) {
  const _auth = await requireAdmin(request, 'cars_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const body = await request.json();
    const { name, model, year, category, seats, price_day, description, features, image_url } = body;

    const result = await pool.query(
      `INSERT INTO cars (name, model, year, category, seats, price_day, description, features, image_url, available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [name, model, year, category, seats, price_day, description, features || [], image_url || null]
    );

    return NextResponse.json({ success: true, car: result.rows[0] }, { status: 201 });

  } catch (error) {
    console.error('Error adding car:', error);
    return NextResponse.json({ success: false, error: 'Failed to add car' }, { status: 500 });
  }
}