// app/api/seat-bookings/initialize/route.js
//
// POST /api/seat-bookings/initialize
// Customer has picked a trip + a seat number. This route:
//   1. Double-checks that seat is still free (someone else may have grabbed it)
//   2. Creates the seat booking as pending + unpaid
//   3. Asks Paystack to start the payment and gives back a payment_url
//
// This mirrors /api/payments/initialize (car rental) exactly, with one
// extra safety step: the seat-lock check, since two people could try to
// book the same seat on the same trip at nearly the same time.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { makeRef } from '@/lib/ref';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';
function getUserFromToken(req) {
  try {
    const h = req.headers.get('authorization');
    if (!h || !h.startsWith('Bearer ')) return null;
    const token = h.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      trip_id,
      seat_number,
      customer_name,
      customer_email,
      customer_phone
    } = body;

    if (!trip_id || !customer_name || !customer_email || !customer_phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the trip + route price + bus seat count + seat-map flag
    const tripResult = await pool.query(
      `SELECT t.id, t.status, b.total_seats, b.seat_map_enabled, r.price
       FROM trips t
       JOIN buses b ON t.bus_id = b.id
       JOIN routes r ON t.route_id = r.id
       WHERE t.id = $1`,
      [trip_id]
    );

    if (tripResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    const trip = tripResult.rows[0];

    if (trip.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: 'This trip is no longer available for booking' },
        { status: 400 }
      );
    }

    // Which seats are already taken (pending or confirmed both count)
    const takenRes = await pool.query(
      `SELECT seat_number FROM seat_bookings
       WHERE trip_id = $1 AND status != 'cancelled'`,
      [trip_id]
    );
    const taken = new Set(takenRes.rows.map(r => r.seat_number));

    // Open-seating buses (seat_map_enabled = false) — or any request that
    // doesn't pick a seat — get the lowest free seat auto-assigned.
    const fcfs = trip.seat_map_enabled === false || seat_number == null;
    let finalSeat;
    if (fcfs) {
      finalSeat = null;
      for (let n = 1; n <= trip.total_seats; n++) {
        if (!taken.has(n)) { finalSeat = n; break; }
      }
      if (finalSeat === null) {
        return NextResponse.json(
          { success: false, error: 'This trip is fully booked.' },
          { status: 409 }
        );
      }
    } else {
      if (seat_number < 1 || seat_number > trip.total_seats) {
        return NextResponse.json(
          { success: false, error: 'Invalid seat number for this bus' },
          { status: 400 }
        );
      }
      if (taken.has(seat_number)) {
        return NextResponse.json(
          { success: false, error: 'This seat has just been taken. Please choose another seat.' },
          { status: 409 }
        );
      }
      finalSeat = seat_number;
    }

    const total_price = parseFloat(trip.price);
    const paymentReference = makeRef('ALB-BUS-');
    const isTransfer = (body.payment_method === 'transfer');

    // A previously-cancelled reservation still occupies this exact (trip, seat)
    // slot under the UNIQUE(trip_id, seat_number) constraint. That makes the seat
    // look free on the map (cancelled rows are excluded from "taken") but blocks
    // re-booking with a duplicate-key error. Clear any cancelled reservation for
    // this seat so it can be booked again. Active bookings were already rejected
    // by the checks above, so only cancelled rows can match here.
    await pool.query(
      `DELETE FROM seat_bookings WHERE trip_id = $1 AND seat_number = $2 AND status = 'cancelled'`,
      [trip_id, finalSeat]
    );

    // Create the seat booking as pending + unpaid.
    // The UNIQUE(trip_id, seat_number) constraint in the database is our
    // final safety net — if two requests race past the check above at the
    // exact same instant, this INSERT will fail for the second one.
    let bookingResult;
    try {
      bookingResult = await pool.query(
        `INSERT INTO seat_bookings 
          (trip_id, seat_number, customer_name, customer_email, customer_phone, total_price, payment_reference, payment_status, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $9, $8)
         RETURNING *`,
        [trip_id, finalSeat, customer_name, customer_email, customer_phone, total_price, paymentReference, getUserFromToken(request)?.userId || null, isTransfer ? 'awaiting_transfer' : 'unpaid']
      );
    } catch (dbError) {
      // 23505 = unique constraint violation — someone else just took this seat
      if (dbError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This seat has just been taken. Please choose another seat.' },
          { status: 409 }
        );
      }
      throw dbError;
    }

    const booking = bookingResult.rows[0];

    if (isTransfer) {
      return NextResponse.json({ success: true, booking, reference: paymentReference, amount: total_price, payment_method: 'transfer' }, { status: 201 });
    }

    // Start the Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: customer_email,
        amount: Math.round(total_price * 100),
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/pages/booking-confirm.html?type=bus`
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      return NextResponse.json(
        { success: false, error: 'Failed to initialize payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      booking,
      payment_url: paystackData.data.authorization_url
    }, { status: 201 });

  } catch (error) {
    console.error('Error initializing seat booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
