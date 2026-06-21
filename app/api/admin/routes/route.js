// app/api/admin/routes/route.js
// GET  → list ALL routes (active and inactive) for admin view
// POST → create a new route

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query('SELECT * FROM routes ORDER BY origin, destination');
    return NextResponse.json({ success: true, routes: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { origin, destination, price, duration_hours, description } = body;

    if (!origin || !destination || !price) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO routes (origin, destination, price, duration_hours, description, active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [origin, destination, price, duration_hours || null, description || null]
    );

    return NextResponse.json({ success: true, route: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating route:', error);
    return NextResponse.json({ success: false, error: 'Failed to create route' }, { status: 500 });
  }
}
