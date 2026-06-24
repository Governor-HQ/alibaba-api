// GET  /api/admin/drivers — list all drivers (with lifecycle status)
// POST is retired — drivers now self-register via the invite link
//      (POST /api/driver/signup) and are approved from the admin panel.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const _auth = await requireAdmin(request, null); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const r = await pool.query('SELECT id, name, phone, username, active, status, created_at FROM drivers ORDER BY created_at DESC');
    return NextResponse.json({ success:true, drivers:r.rows });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, null); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  // Admin-created drivers are replaced by invite-based self-signup + approval.
  return NextResponse.json(
    { success:false, error:'Drivers now self-register via the invite link, then are approved here. Use the Driver Signup Link in the Drivers tab.' },
    { status:410 }
  );
}
