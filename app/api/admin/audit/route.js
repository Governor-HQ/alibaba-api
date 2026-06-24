// GET /api/admin/audit — recent admin actions (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const r = await pool.query('SELECT id, admin_username, action, detail, created_at FROM admin_audit ORDER BY created_at DESC LIMIT 200');
  return NextResponse.json({ success:true, log:r.rows });
}
