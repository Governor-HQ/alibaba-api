// GET /api/admin/manual-payments — list submitted transfer proofs (payments_verify)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request) {
  const a = await requireAdmin(request, 'payments_verify');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // optional filter
  const params = [];
  let where = '';
  if (status) { params.push(status); where = 'WHERE status = $1'; }
  const r = await pool.query(
    `SELECT id, booking_type, reference, amount, sender_name, status, created_at, confirmed_by, confirmed_at
     FROM manual_payments ${where} ORDER BY (status='pending') DESC, created_at DESC`, params
  );
  return NextResponse.json({ success:true, payments:r.rows });
}
