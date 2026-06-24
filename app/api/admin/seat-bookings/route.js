// app/api/admin/seat-bookings/route.js
// GET → admin sees every seat booking across all trips, with full trip/route/customer info

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request) {
  const _auth = await requireAdmin(request, 'bookings_bus'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

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

    // Normalize departure_date to a plain YYYY-MM-DD string so the client can
    // format it safely. (pg returns DATE columns as JS Date objects, which JSON-
    // serialize to a full ISO timestamp and break the client's date formatter.)
    const bookings = result.rows.map(b => ({
      ...b,
      departure_date: b.departure_date instanceof Date
        ? b.departure_date.toISOString().split('T')[0]
        : (typeof b.departure_date === 'string'
            ? b.departure_date.split('T')[0]
            : b.departure_date)
    }));

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error('Error fetching seat bookings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
