// app/api/trips/[id]/seats/route.js
//
// GET /api/trips/5/seats → returns the full seat map for trip #5
// Shows every seat number from 1 to total_seats, marking each as
// "taken" or "available" so the frontend can draw a visual seat map.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Get the trip + bus info (we need total_seats to build the full map)
    const tripResult = await pool.query(
      `SELECT t.id, b.total_seats, b.bus_type, b.name as bus_name,
              r.origin, r.destination, r.price, t.departure_date, t.departure_time
       FROM trips t
       JOIN buses b ON t.bus_id = b.id
       JOIN routes r ON t.route_id = r.id
       WHERE t.id = $1`,
      [id]
    );

    if (tripResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    const trip = tripResult.rows[0];

    // Get all seats already booked (not cancelled) for this trip
    const bookedResult = await pool.query(
      `SELECT seat_number FROM seat_bookings 
       WHERE trip_id = $1 AND status != 'cancelled'`,
      [id]
    );

    const takenSeats = new Set(bookedResult.rows.map(r => r.seat_number));

    // Build the full seat map: every seat number, marked taken or not
    const seatMap = [];
    for (let seatNum = 1; seatNum <= trip.total_seats; seatNum++) {
      seatMap.push({
        seat_number: seatNum,
        taken: takenSeats.has(seatNum)
      });
    }

    return NextResponse.json({
      success: true,
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        price: trip.price,
        departure_date: trip.departure_date,
        departure_time: trip.departure_time,
        bus_name: trip.bus_name,
        bus_type: trip.bus_type,
        total_seats: trip.total_seats
      },
      seats: seatMap
    });

  } catch (error) {
    console.error('Error fetching seat map:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch seat map' },
      { status: 500 }
    );
  }
}
