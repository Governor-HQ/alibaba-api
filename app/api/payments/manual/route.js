// POST /api/payments/manual — customer submits proof of a bank transfer.
// Creates a pending manual_payments record + uploads the receipt to Storage,
// and flips the booking to 'processing'. NEVER marks the booking paid — only
// an admin with payments_verify can do that.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { uploadReceipt, storageConfigured } from '@/lib/storage';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const TABLES = { car: 'bookings', bus: 'seat_bookings', charter: 'charter_bookings' };

export async function POST(request) {
  const _rl = await rateLimit(`manualpay:${clientIp(request)}`, 15, 3600);
  if (!_rl.ok) return NextResponse.json({ success:false, error:'Too many attempts. Please wait a few minutes and try again.' }, { status:429 });
  try {
    if (!storageConfigured()) {
      return NextResponse.json({ success:false, error:'Receipt uploads are not configured yet. Please contact support.' }, { status:503 });
    }
    const { booking_type, reference, sender_name, receipt_base64, receipt_content_type } = await request.json();
    if (!booking_type || !reference || !sender_name || !receipt_base64) {
      return NextResponse.json({ success:false, error:'Please provide your name and attach your payment receipt.' }, { status:400 });
    }
    const table = TABLES[booking_type];
    if (!table) return NextResponse.json({ success:false, error:'Invalid booking type.' }, { status:400 });

    const bk = await pool.query(`SELECT id, total_price AS amount, payment_status FROM ${table} WHERE payment_reference = $1`, [reference]);
    if (!bk.rows.length) return NextResponse.json({ success:false, error:'Booking not found.' }, { status:404 });
    if (bk.rows[0].payment_status === 'paid') return NextResponse.json({ success:false, error:'This booking is already paid.' }, { status:409 });

    // Decode + cap the image size (the client also compresses before sending).
    const b64 = String(receipt_base64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return NextResponse.json({ success:false, error:'Invalid receipt file.' }, { status:400 });
    if (buffer.length > 5 * 1024 * 1024) return NextResponse.json({ success:false, error:'Receipt too large (max 5MB).' }, { status:413 });

    const ct = receipt_content_type || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('pdf') ? 'pdf' : 'jpg';
    const path = `${reference}-${Date.now()}.${ext}`;
    await uploadReceipt(path, buffer, ct);

    await pool.query(
      `INSERT INTO manual_payments (booking_type, reference, amount, sender_name, receipt_path, status)
       VALUES ($1,$2,$3,$4,$5,'pending')`,
      [booking_type, reference, bk.rows[0].amount, String(sender_name).trim().slice(0, 120), path]
    );
    await pool.query(`UPDATE ${table} SET payment_status='processing' WHERE payment_reference=$1`, [reference]);

    return NextResponse.json({ success:true });
  } catch (e) {
    console.error('manual payment submit', e);
    return NextResponse.json({ success:false, error:'Could not submit your proof. Please try again.' }, { status:500 });
  }
}
