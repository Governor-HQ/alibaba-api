// GET /api/admin/manual-payments — list submitted transfer proofs (payments_verify)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parsePaging, pageMeta } from '@/lib/paginate';

export async function GET(request) {
  const a = await requireAdmin(request, 'payments_verify');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // optional filter
  const { page, limit, offset } = parsePaging(request);
  const params = [];
  let where = '';
  if (status) { params.push(status); where = 'WHERE status = $1'; }
  const total = (await pool.query(`SELECT COUNT(*)::int AS total FROM manual_payments ${where}`, params)).rows[0].total;
  const rowParams = [...params, limit, offset];
  const r = await pool.query(
    `SELECT id, booking_type, reference, amount, sender_name, status, created_at, confirmed_by, confirmed_at
     FROM manual_payments ${where} ORDER BY (status='pending') DESC, created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, rowParams
  );
  return NextResponse.json({ success:true, payments:r.rows, ...pageMeta(total, page, limit) });
}
