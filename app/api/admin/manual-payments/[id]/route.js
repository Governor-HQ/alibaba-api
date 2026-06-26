// /api/admin/manual-payments/[id]
//   GET  → record + linked booking + short-lived signed receipt URL (payments_verify)
//   POST → { action:'confirm'|'reject' } completes or rejects the transfer (payments_verify)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';
import { signReceipt } from '@/lib/storage';

const TABLES = { car: 'bookings', bus: 'seat_bookings', charter: 'charter_bookings' };

async function loadBooking(type, reference) {
  if (type === 'car') {
    const r = await pool.query(
      `SELECT b.*, c.name AS car_name, c.model FROM bookings b JOIN cars c ON b.car_id=c.id WHERE b.payment_reference=$1`, [reference]);
    return r.rows[0] || null;
  }
  if (type === 'bus') {
    const r = await pool.query(
      `SELECT sb.*, t.departure_date, t.departure_time, r.origin, r.destination, bus.name AS bus_name
       FROM seat_bookings sb JOIN trips t ON sb.trip_id=t.id JOIN routes r ON t.route_id=r.id JOIN buses bus ON t.bus_id=bus.id
       WHERE sb.payment_reference=$1`, [reference]);
    return r.rows[0] || null;
  }
  const r = await pool.query(`SELECT * FROM charter_bookings WHERE payment_reference=$1`, [reference]);
  return r.rows[0] || null;
}

export async function GET(request, { params }) {
  const a = await requireAdmin(request, 'payments_verify');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const { id } = await params;
  const mp = await pool.query('SELECT * FROM manual_payments WHERE id=$1', [id]);
  if (!mp.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
  const row = mp.rows[0];
  const booking = await loadBooking(row.booking_type, row.reference);
  const receipt_url = await signReceipt(row.receipt_path, 3600);
  return NextResponse.json({ success:true, payment:row, booking, receipt_url });
}

export async function POST(request, { params }) {
  const a = await requireAdmin(request, 'payments_verify');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { id } = await params;
    const { action } = await request.json();
    const mp = await pool.query('SELECT * FROM manual_payments WHERE id=$1', [id]);
    if (!mp.rows.length) return NextResponse.json({ success:false, error:'Not found.' }, { status:404 });
    const row = mp.rows[0];
    const table = TABLES[row.booking_type];
    if (!table) return NextResponse.json({ success:false, error:'Invalid booking type.' }, { status:400 });

    if (action === 'confirm') {
      await pool.query(`UPDATE ${table} SET payment_status='paid', status='confirmed' WHERE payment_reference=$1`, [row.reference]);
      await pool.query(`UPDATE manual_payments SET status='confirmed', confirmed_by=$1, confirmed_at=NOW() WHERE id=$2`, [a.admin.username, id]);
      await logAdminAction(a.admin, 'confirm_payment', `Confirmed transfer ${row.reference} (₦${row.amount})`);
      return NextResponse.json({ success:true });
    }
    if (action === 'reject') {
      await pool.query(`UPDATE ${table} SET payment_status='unpaid' WHERE payment_reference=$1 AND payment_status<>'paid'`, [row.reference]);
      await pool.query(`UPDATE manual_payments SET status='rejected', confirmed_by=$1, confirmed_at=NOW() WHERE id=$2`, [a.admin.username, id]);
      await logAdminAction(a.admin, 'reject_payment', `Rejected transfer ${row.reference}`);
      return NextResponse.json({ success:true });
    }
    return NextResponse.json({ success:false, error:'Unknown action.' }, { status:400 });
  } catch (e) {
    console.error('manual payment action', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
