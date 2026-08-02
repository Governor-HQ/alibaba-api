// GET /api/admin/audit — recent admin actions (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parsePaging, pageMeta } from '@/lib/paginate';
export async function GET(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const { page, limit, offset } = parsePaging(request);
  const total = (await pool.query('SELECT COUNT(*)::int AS total FROM admin_audit')).rows[0].total;
  const r = await pool.query(
    'SELECT id, admin_username, action, detail, created_at FROM admin_audit ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return NextResponse.json({ success:true, log:r.rows, ...pageMeta(total, page, limit) });
}
