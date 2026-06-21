import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  // Skip admin token
  if (authHeader === `Bearer ${process.env.ADMIN_SECRET}`) return null;
  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, notes } = body;

    if (!car_id || !customer_name || !customer_email || !customer_phone || !pickup_date || !return_date || !pickup_location) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const carResult = await pool.query('SELECT price_day FROM cars WHERE id = $1', [car_id]);
    if (carResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Car not found' }, { status: 404 });
    }

    const pricePerDay = parseFloat(carResult.rows[0].price_day);
    const days = Math.max(1, Math.ceil((new Date(return_date) - new Date(pickup_date)) / (1000 * 60 * 60 * 24)));
    const total_price = pricePerDay * days;
    const paymentReference = `ALB-PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Attach user_id if logged in
    const userToken = getUserFromToken(request);
    const user_id = userToken ? userToken.userId : null;

    const bookingResult = await pool.query(
      `INSERT INTO bookings (car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes, payment_reference, payment_status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unpaid', $11) RETURNING *`,
      [car_id, customer_name, customer_email, customer_phone, pickup_date, return_date, pickup_location, total_price, notes || null, paymentReference, user_id]
    );

    const booking = bookingResult.rows[0];

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customer_email,
        amount: Math.round(total_price * 100),
        reference: paymentReference,
        callback_url: `${process.env.FRONTEND_URL}/pages/booking-confirm.html`
      })
    });

    const paystackData = await paystackResponse.json();
    if (!paystackData.status) {
      return NextResponse.json({ success: false, error: 'Failed to initialize payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, booking, payment_url: paystackData.data.authorization_url }, { status: 201 });

  } catch (error) {
    console.error('Error initializing payment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create booking' }, { status: 500 });
  }
}
