// app/api/seat-bookings/hold/route.js
//
// GET /api/seat-bookings/hold?reference=ALB-BUS-xxxx
// Lightweight, public (the unguessable reference is the credential — same model
// as /api/payments/verify) lookup used by the bank-transfer page to drive the
// seat-hold countdown. Returns ONLY non-sensitive hold state, no customer PII,
// and makes no external (Paystack) calls.
//
// Bus bookings only. hold_expires_at semantics:
//   - a future timestamp  → seat is held, count down to it
//   - null                → never expires (receipt uploaded / paid / confirmed)
//   - a past timestamp     → the hold has lapsed
//
// TODO: car rentals + charter bookings could get the same hold system later;
// this endpoint would then generalise beyond the ALB-BUS- prefix.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const reference = new URL(request.url).searchParams.get('reference');
    if (!reference || !reference.startsWith('ALB-BUS-')) {
      return NextResponse.json({ success:false, error:'A valid bus booking reference is required.' }, { status:400 });
    }
    const r = await pool.query(
      'SELECT payment_status, hold_expires_at FROM seat_bookings WHERE payment_reference = $1',
      [reference]
    );
    if (!r.rows.length) return NextResponse.json({ success:false, error:'Booking not found.' }, { status:404 });
    return NextResponse.json({
      success: true,
      reference,
      payment_status: r.rows[0].payment_status,
      hold_expires_at: r.rows[0].hold_expires_at
    });
  } catch (e) {
    console.error('seat hold lookup', e);
    return NextResponse.json({ success:false, error:'Failed to load hold status.' }, { status:500 });
  }
}
