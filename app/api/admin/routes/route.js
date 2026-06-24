// app/api/admin/routes/route.js
// GET  → list ALL routes (active and inactive) for admin view
// POST → create a new route

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request) {
  const _auth = await requireAdmin(request, 'routes_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const result = await pool.query('SELECT * FROM routes ORDER BY origin, destination');
    return NextResponse.json({ success: true, routes: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch routes' }, { status: 500 });
  }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, 'routes_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

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
