// app/api/admin/buses/route.js
// GET  → list all buses
// POST → add a new bus to the interstate fleet

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request) {
  const _auth = await requireAdmin(request, 'buses_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const result = await pool.query('SELECT * FROM buses ORDER BY created_at DESC');
    return NextResponse.json({ success: true, buses: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch buses' }, { status: 500 });
  }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, 'buses_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const body = await request.json();
    const { name, plate_number, total_seats, bus_type } = body;

    if (!name || !total_seats) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO buses (name, plate_number, total_seats, bus_type, active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [name, plate_number || null, total_seats, bus_type || 'standard']
    );

    return NextResponse.json({ success: true, bus: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating bus:', error);
    return NextResponse.json({ success: false, error: 'Failed to create bus' }, { status: 500 });
  }
}
