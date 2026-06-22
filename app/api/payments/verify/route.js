import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ success: false, error: 'Missing payment reference' }, { status: 400 });
    }

    // Ask Paystack directly what the real status of this payment is
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    const paystackData = await paystackResponse.json();

    const isSeatBooking = reference.startsWith('ALB-BUS-');
    const isCharter = reference.startsWith('ALB-CHT-');

    if (paystackData.status && paystackData.data.status === 'success') {
      // Update our database too, in case the webhook hasn't arrived yet
      if (isCharter) {
        await pool.query(
          `UPDATE charter_bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE payment_reference = $1`,
          [reference]
        );
      } else if (isSeatBooking) {
        await pool.query(
          `UPDATE seat_bookings SET payment_status = 'paid', status = 'confirmed' WHERE payment_reference = $1`,
          [reference]
        );
      } else {
        await pool.query(
          `UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE payment_reference = $1`,
          [reference]
        );
      }
    }

    if (isCharter) {
      const chRes = await pool.query(
        `SELECT * FROM charter_bookings WHERE payment_reference = $1`,
        [reference]
      );
      if (chRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Charter not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, booking_type: 'charter', booking: chRes.rows[0] });
    }

    if (isSeatBooking) {
      const seatResult = await pool.query(
        `SELECT sb.*, t.departure_date, t.departure_time, r.origin, r.destination, b.name as bus_name
         FROM seat_bookings sb
         JOIN trips t ON sb.trip_id = t.id
         JOIN routes r ON t.route_id = r.id
         JOIN buses b ON t.bus_id = b.id
         WHERE sb.payment_reference = $1`,
        [reference]
      );

      if (seatResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, booking_type: 'bus', booking: seatResult.rows[0] });
    }

    const bookingResult = await pool.query(
      `SELECT b.*, c.name as car_name, c.model FROM bookings b
       JOIN cars c ON b.car_id = c.id
       WHERE b.payment_reference = $1`,
      [reference]
    );

    if (bookingResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, booking_type: 'car', booking: bookingResult.rows[0] });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
