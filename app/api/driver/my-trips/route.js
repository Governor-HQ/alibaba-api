// GET /api/driver/my-trips — interstate trips + charter bookings assigned to this driver
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function GET(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const trips = await pool.query(
      `SELECT t.id, t.departure_date, t.departure_time, t.trip_status,
              r.origin, r.destination, b.name as bus_name, b.total_seats,
              (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.trip_id = t.id AND sb.status='confirmed') as booked_seats,
              (SELECT COUNT(*) FROM seat_bookings sb WHERE sb.trip_id = t.id AND sb.used_at IS NOT NULL) as boarded_seats
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       WHERE t.driver_id = $1
       ORDER BY t.departure_date DESC, t.departure_time DESC`,
      [d.driverId]
    );
    const charters = await pool.query(
      `SELECT id, reference, vehicle_type_name, zone_name, quantity, trip_type, trip_status,
              event_date, pickup_location, destination, contact_name, contact_phone, status, used_at
       FROM charter_bookings
       WHERE driver_id = $1
       ORDER BY event_date DESC`,
      [d.driverId]
    );
    return NextResponse.json({ success:true, interstate_trips: trips.rows, charters: charters.rows });
  } catch (e) {
    console.error('Driver my-trips error:', e);
    return NextResponse.json({ success:false, error:'Failed to load trips.' }, { status:500 });
  }
}
