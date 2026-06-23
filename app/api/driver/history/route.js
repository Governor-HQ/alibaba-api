// GET /api/driver/history — driver's completed/past trips (interstate + charter)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function GET(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const trips = await pool.query(
      `SELECT t.id, t.departure_date, t.departure_time, t.trip_status,
              r.origin, r.destination, b.name as bus_name,
              (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.trip_id = t.id AND sb.used_at IS NOT NULL) as boarded_seats
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       WHERE t.driver_id = $1 AND t.trip_status = 'completed'
       ORDER BY t.departure_date DESC`,
      [d.driverId]
    );
    const charters = await pool.query(
      `SELECT id, reference, vehicle_type_name, quantity, event_date, pickup_location, destination, trip_status
       FROM charter_bookings
       WHERE driver_id = $1 AND trip_status = 'completed'
       ORDER BY event_date DESC`,
      [d.driverId]
    );
    return NextResponse.json({ success:true, interstate_trips: trips.rows, charters: charters.rows });
  } catch (e) {
    console.error('Driver history error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
