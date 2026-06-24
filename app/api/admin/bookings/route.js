// app/api/bookings/route.js
//
// POST /api/bookings → customer submits a booking form, we save it to the database
// GET  /api/bookings → admin sees all bookings (protected later)

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      car_id,
      customer_name,
      customer_email,
      customer_phone,
      pickup_date,
      return_date,
      pickup_location,
      notes
    } = body;

    // Basic validation — make sure required fields are present
    if (!car_id || !customer_name || !customer_email || !customer_phone || !pickup_date || !return_date || !pickup_location) {
      return NextResponse.json(
        { success: false, error: 'Please fill in all required fields' },
        { status: 400 }
      );
    }

    // Check the car exists and is available
    const carResult = await pool.query(
      'SELECT * FROM cars WHERE id = $1 AND available = true',
      [car_id]
    );

    if (carResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This car is not available for booking' },
        { status: 400 }
      );
    }

    const car = carResult.rows[0];

    // Check the car isn't already booked for those dates
    const conflictResult = await pool.query(
      `SELECT id FROM bookings 
       WHERE car_id = $1 
       AND status != 'cancelled'
       AND (
         (pickup_date <= $2 AND return_date >= $2) OR
         (pickup_date <= $3 AND return_date >= $3) OR
         (pickup_date >= $2 AND return_date <= $3)
       )`,
      [car_id, pickup_date, return_date]
    );

    if (conflictResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'This car is already booked for those dates. Please choose different dates.' },
        { status: 400 }
      );
    }

    // Calculate total price
    // Number of days = difference between return and pickup dates
    const start = new Date(pickup_date);
    const end = new Date(return_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (days < 1) {
      return NextResponse.json(
        { success: false, error: 'Return date must be after pickup date' },
        { status: 400 }
      );
    }

    const total_price = days * parseFloat(car.price_day);

    // Save the booking to the database
    const bookingResult = await pool.query(
      `INSERT INTO bookings 
        (car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes || null]
    );

    return NextResponse.json({
      success: true,
      message: 'Booking submitted successfully',
      booking: bookingResult.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  // Only admins can see the full bookings list
  const _auth = await requireAdmin(request, 'bookings_car'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });

  try {
    const result = await pool.query(
      `SELECT b.*, c.name as car_name, c.model as car_model 
       FROM bookings b 
       JOIN cars c ON b.car_id = c.id 
       ORDER BY b.created_at DESC`
    );

    return NextResponse.json({
      success: true,
      bookings: result.rows
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}