// app/api/admin/cars/route.js
//
// This is the admin-only endpoint for managing cars.
// POST → add a new car to the fleet
// All admin routes will eventually require a login token

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// Simple token check — we'll tighten this with full auth later
function isAuthorized(request) {
  const token = request.headers.get('authorization');
  return token === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET all cars including unavailable ones (admin sees everything)
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await pool.query('SELECT * FROM cars ORDER BY created_at DESC');
  return NextResponse.json({ success: true, cars: result.rows });
}

// POST — add a new car
export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

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