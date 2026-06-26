// POST /api/charter/book — create a charter booking and start Paystack payment.
// Price is recomputed server-side; the client cannot set the price.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { makeRef } from '@/lib/ref';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  try { return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET); }
  catch { return null; }
}

export async function POST(request) {
  const user = getUserFromToken(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Please log in to book.' }, { status: 401 });
  }

  try {
    const b = await request.json();
    const {
      zone_id, vehicle_type_id, trip_type, quantity,
      event_date, pickup_location, destination,
      trip_purpose, guest_count, notes,
      contact_name, contact_email, contact_phone,
      agreed_terms
    } = b;

    if (!zone_id || !vehicle_type_id || !event_date || !pickup_location || !destination ||
        !contact_name || !contact_email || !contact_phone) {
      return NextResponse.json({ success: false, error: 'Please fill all required fields.' }, { status: 400 });
    }
    if (!agreed_terms) {
      return NextResponse.json({ success: false, error: 'You must agree to the terms & conditions.' }, { status: 400 });
    }

    const qty = Math.max(1, parseInt(quantity) || 1);

    // Recompute price server-side
    const priceRow = await pool.query(
      'SELECT round_trip_price FROM charter_prices WHERE zone_id = $1 AND vehicle_type_id = $2',
      [zone_id, vehicle_type_id]
    );
    if (priceRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No price available for this selection.' }, { status: 404 });
    }
    const roundTrip = parseFloat(priceRow.rows[0].round_trip_price);
    const factorRow = await pool.query("SELECT value FROM charter_settings WHERE key = 'one_way_factor'");
    const factor = factorRow.rows.length ? parseFloat(factorRow.rows[0].value) : 0.6;
    const isRound = trip_type !== 'one_way';
    const unitPrice = isRound ? roundTrip : Math.round(roundTrip * factor);
    const totalPrice = unitPrice * qty;

    // Snapshot names
    const vt = await pool.query('SELECT name FROM charter_vehicle_types WHERE id = $1', [vehicle_type_id]);
    const zn = await pool.query('SELECT name FROM charter_zones WHERE id = $1', [zone_id]);
    if (vt.rows.length === 0 || zn.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid selection.' }, { status: 404 });
    }

    const reference = makeRef('ALB-CHT-');
    const isTransfer = (b.payment_method === 'transfer');

    const ins = await pool.query(
      `INSERT INTO charter_bookings
        (user_id, reference, vehicle_type_id, vehicle_type_name, zone_id, zone_name,
         quantity, trip_type, unit_price, total_price,
         event_date, pickup_location, destination, trip_purpose, guest_count, notes,
         contact_name, contact_email, contact_phone, status, payment_reference, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending',$20,$21)
       RETURNING *`,
      [
        user.userId, reference, vehicle_type_id, vt.rows[0].name, zone_id, zn.rows[0].name,
        qty, isRound ? 'round_trip' : 'one_way', unitPrice, totalPrice,
        event_date, pickup_location.trim(), destination.trim(),
        trip_purpose?.trim() || null, guest_count || null, notes?.trim() || null,
        contact_name.trim(), contact_email.toLowerCase().trim(), contact_phone.trim(),
        reference, isTransfer ? 'awaiting_transfer' : 'unpaid'
      ]
    );

    if (isTransfer) {
      return NextResponse.json({ success: true, booking: ins.rows[0], reference, amount: totalPrice, payment_method: 'transfer' }, { status: 201 });
    }

    // Start Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: contact_email,
        amount: Math.round(totalPrice * 100),
        reference: reference,
        callback_url: `${process.env.FRONTEND_URL}/pages/booking-confirm.html`
      })
    });
    const paystackData = await paystackResponse.json();
    if (!paystackData.status) {
      return NextResponse.json({ success: false, error: 'Failed to start payment.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      booking: ins.rows[0],
      payment_url: paystackData.data.authorization_url
    }, { status: 201 });

  } catch (error) {
    console.error('Charter book error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create booking.' }, { status: 500 });
  }
}
