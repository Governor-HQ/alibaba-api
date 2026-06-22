// POST /api/driver/checkin { reference }
// Marks a valid ticket as USED. Guards against: not found, unpaid, cancelled,
// already used, or belonging to another driver's trip.
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
        `SELECT sb.*, t.driver_id FROM seat_bookings sb JOIN trips t ON sb.trip_id = t.id
         WHERE sb.payment_reference = $1`, [ref]);
      if (!r.rows.length) return NextResponse.json({ success:false, error:'Ticket not found.' }, { status:404 });
      const tk = r.rows[0];
      const guard = guardCheck(tk, tk.driver_id, d.driverId);
      if (guard) return NextResponse.json({ success:false, error:guard, used_at: tk.used_at }, { status:409 });
      await pool.query('UPDATE seat_bookings SET used_at=NOW(), used_by_driver=$1 WHERE id=$2', [d.driverId, tk.id]);
      return NextResponse.json({ success:true, message:`Seat ${tk.seat_number} — ${tk.customer_name} boarded.` });
    } else if (isCharter) {
      const r = await pool.query('SELECT * FROM charter_bookings WHERE reference = $1 OR payment_reference = $1', [ref]);
      if (!r.rows.length) return NextResponse.json({ success:false, error:'Ticket not found.' }, { status:404 });
      const tk = r.rows[0];
      const guard = guardCheck(tk, tk.driver_id, d.driverId);
      if (guard) return NextResponse.json({ success:false, error:guard, used_at: tk.used_at }, { status:409 });
      await pool.query('UPDATE charter_bookings SET used_at=NOW(), used_by_driver=$1 WHERE id=$2', [d.driverId, tk.id]);
      return NextResponse.json({ success:true, message:`${tk.contact_name} — charter checked in.` });
    } else {
      return NextResponse.json({ success:false, error:'This reference is not a boardable ticket.' }, { status:400 });
    }
  } catch (e) {
    console.error('Checkin error:', e);
    return NextResponse.json({ success:false, error:'Check-in failed.' }, { status:500 });
  }
}

function guardCheck(tk, ticketDriverId, myDriverId) {
  if (tk.payment_status !== 'paid') return 'This ticket is not paid.';
  if (tk.status === 'cancelled') return 'This ticket was cancelled.';
  if (tk.status === 'expired') return 'This ticket has expired.';
  if (tk.used_at) return 'ALREADY USED';
  if (ticketDriverId != null && ticketDriverId !== myDriverId) return 'This ticket is not for your trip.';
  return null;
}
