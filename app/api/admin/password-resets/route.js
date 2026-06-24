// GET /api/admin/password-resets
// Pending reset codes for the team to relay to customers over WhatsApp.
// (Interim — until reset codes are emailed automatically.)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'resets_view'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const r = await pool.query(
      `SELECT pr.id, pr.code, pr.attempts, pr.created_at, pr.expires_at,
              u.first_name, u.last_name, u.email, u.phone
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.used = false AND pr.expires_at > NOW()
       ORDER BY pr.created_at DESC`
    );
    return NextResponse.json({ success:true, requests: r.rows });
  } catch (e) {
    console.error('Admin password-resets error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
