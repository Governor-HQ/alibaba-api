// app/api/admin/seat-bookings/route.js
// GET → admin sees every seat booking across all trips, with full trip/route/customer info

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
    const result = await pool.query(
      `SELECT 
        sb.*, 
        t.departure_date, t.departure_time,
        r.origin, r.destination,
        b.name as bus_name
       FROM seat_bookings sb
       JOIN trips t ON sb.trip_id = t.id
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       ORDER BY sb.created_at DESC`
    );

    return NextResponse.json({ success: true, bookings: result.rows });
  } catch (error) {
    console.error('Error fetching seat bookings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
