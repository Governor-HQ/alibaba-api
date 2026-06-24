// app/api/admin/trips/route.js
// GET  → list all trips with route, bus, and seat info (for admin scheduling view)
// POST → create a new trip (a specific scheduled departure)

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request) {
  const _auth = await requireAdmin(request, 'trips_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const result = await pool.query(
      `SELECT 
        t.id, t.departure_date, t.departure_time, t.status, t.driver_id, t.trip_status,
        r.id as route_id, r.origin, r.destination, r.price,
        b.id as bus_id, b.name as bus_name, b.total_seats,
        (SELECT COUNT(*) FROM seat_bookings sb 
         WHERE sb.trip_id = t.id AND sb.status != 'cancelled') as seats_booked
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       ORDER BY t.departure_date DESC, t.departure_time DESC`
    );

    const trips = result.rows.map(t => ({
      ...t,
      departure_date: t.departure_date instanceof Date
        ? t.departure_date.toISOString().split('T')[0]
        : t.departure_date,
      seats_available: t.total_seats - parseInt(t.seats_booked)
    }));

    return NextResponse.json({ success: true, trips });
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch trips' }, { status: 500 });
  }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, 'trips_manage'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const body = await request.json();
    const { route_id, bus_id, departure_date, departure_time } = body;

    if (!route_id || !bus_id || !departure_date || !departure_time) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO trips (route_id, bus_id, departure_date, departure_time, status)
       VALUES ($1, $2, $3, $4, 'scheduled') RETURNING *`,
      [route_id, bus_id, departure_date, departure_time]
    );

    return NextResponse.json({ success: true, trip: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json({ success: false, error: 'Failed to create trip' }, { status: 500 });
  }
}
