// app/api/trips/route.js
//
// GET /api/trips?route_id=2 → returns upcoming scheduled trips for that route
// Each trip shows how many seats are taken vs total, so the frontend
// can show "12 seats left" before the customer even picks a seat.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('route_id');

    if (!routeId) {
      return NextResponse.json(
        { success: false, error: 'route_id is required' },
        { status: 400 }
      );
    }

    // Get all upcoming scheduled trips for this route, with bus info
    // and a count of how many seats are already booked (paid or pending)
    const result = await pool.query(
      `SELECT 
        t.id, t.departure_date, t.departure_time, t.status,
        b.id as bus_id, b.name as bus_name, b.bus_type, b.total_seats, b.seat_map_enabled,
        r.origin, r.destination, r.price, r.duration_hours,
        (SELECT COUNT(*) FROM seat_bookings sb 
         WHERE sb.trip_id = t.id AND sb.status != 'cancelled') as seats_taken
       FROM trips t
       JOIN buses b ON t.bus_id = b.id
       JOIN routes r ON t.route_id = r.id
       WHERE t.route_id = $1 
         AND t.status = 'scheduled'
         AND t.departure_date >= CURRENT_DATE
       ORDER BY t.departure_date, t.departure_time`,
      [routeId]
    );

    // Add a calculated "seats_available" field for easy frontend use
    const trips = result.rows.map(trip => ({
      ...trip,
      departure_date: trip.departure_date instanceof Date
        ? trip.departure_date.toISOString().split('T')[0]
        : trip.departure_date,
      seats_available: trip.total_seats - parseInt(trip.seats_taken)
    }));

    return NextResponse.json({
      success: true,
      trips
    });

  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trips' },
      { status: 500 }
    );
  }
}
