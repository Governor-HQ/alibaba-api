// POST /api/driver/verify-ticket { reference }
// Read-only: tells the driver if a ticket is valid, paid, for their assigned trip, and whether already used.
// Does NOT mark it used (that's /checkin).
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { getDriverFromRequest } from '@/lib/driver-auth';

export async function POST(request) {
  const d = getDriverFromRequest(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const { reference } = await request.json();
    if (!reference) return NextResponse.json({ success:false, error:'Enter a ticket reference.' }, { status:400 });

    const ref = reference.trim();
    const isCharter = ref.startsWith('ALB-CHT-');
    const isBus = ref.startsWith('ALB-BUS-');

    if (isBus) {
      const r = await pool.query(
        `SELECT sb.*, t.driver_id, t.departure_date, r.origin, r.destination
         FROM seat_bookings sb
         JOIN trips t ON sb.trip_id = t.id
         JOIN routes r ON t.route_id = r.id
         WHERE sb.payment_reference = $1`, [ref]);
      if (!r.rows.length) return NextResponse.json({ success:true, result:'not_found' });
      const tk = r.rows[0];
      return NextResponse.json({ success:true, result: classify(tk, tk.driver_id, d.driverId), ticket: {
        type:'bus', passenger: tk.customer_name, seat: tk.seat_number,
        route: `${tk.origin} → ${tk.destination}`, status: tk.status,
        paid: tk.payment_status === 'paid', used_at: tk.used_at,
        belongs_to_you: tk.driver_id === d.driverId
      }});
    } else if (isCharter) {
      const r = await pool.query('SELECT * FROM charter_bookings WHERE reference = $1 OR payment_reference = $1', [ref]);
      if (!r.rows.length) return NextResponse.json({ success:true, result:'not_found' });
      const tk = r.rows[0];
      return NextResponse.json({ success:true, result: classify(tk, tk.driver_id, d.driverId), ticket: {
        type:'charter', passenger: tk.contact_name, vehicle: tk.vehicle_type_name,
        route: `${tk.pickup_location} → ${tk.destination}`, status: tk.status,
        paid: tk.payment_status === 'paid', used_at: tk.used_at,
        belongs_to_you: tk.driver_id === d.driverId
      }});
    } else {
      // Car rental reference (ALB-PAY-)
      const r = await pool.query('SELECT * FROM bookings WHERE payment_reference = $1', [ref]);
      if (!r.rows.length) return NextResponse.json({ success:true, result:'not_found' });
      const tk = r.rows[0];
      return NextResponse.json({ success:true, result: classify(tk, null, d.driverId), ticket: {
        type:'car', customer: tk.customer_name, status: tk.status,
        paid: tk.payment_status === 'paid', used_at: tk.used_at, belongs_to_you: false
      }});
    }
  } catch (e) {
    console.error('Verify ticket error:', e);
    return NextResponse.json({ success:false, error:'Verification failed.' }, { status:500 });
  }
}

function classify(tk, ticketDriverId, myDriverId) {
  if (tk.payment_status !== 'paid' || tk.status === 'cancelled' || tk.status === 'expired') return 'invalid';
  if (tk.used_at) return 'already_used';
  if (ticketDriverId != null && ticketDriverId !== myDriverId) return 'wrong_trip';
  return 'valid';
}
