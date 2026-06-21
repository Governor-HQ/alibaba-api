import pool from '@/lib/db';
import { NextResponse } from 'next/server';

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

    if (!car_id || !customer_name || !customer_email || !customer_phone || !pickup_date || !return_date || !pickup_location) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Get the car's price per day so we can calculate total_price ourselves
    const carResult = await pool.query('SELECT price_day FROM cars WHERE id = $1', [car_id]);

    if (carResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Car not found' }, { status: 404 });
    }

    const pricePerDay = parseFloat(carResult.rows[0].price_day);

    const days = Math.max(
      1,
      Math.ceil((new Date(return_date) - new Date(pickup_date)) / (1000 * 60 * 60 * 24))
    );

    const total_price = pricePerDay * days;

    const result = await pool.query(
      `INSERT INTO bookings (car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes || null]
    );

    return NextResponse.json({ success: true, booking: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json({ success: false, error: 'Failed to create booking' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT b.*, c.name as car_name, c.model FROM bookings b
       JOIN cars c ON b.car_id = c.id
       ORDER BY b.created_at DESC`
    );
    return NextResponse.json({ success: true, bookings: result.rows });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}