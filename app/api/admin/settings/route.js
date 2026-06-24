// /api/admin/settings  GET: read settings (any admin) · POST: update (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function GET(request) {
  const a = await requireAdmin(request);
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const r = await pool.query("SELECT value FROM app_settings WHERE key='business_whatsapp'");
  return NextResponse.json({ success:true, business_whatsapp: r.rows[0]?.value || '' });
}

export async function POST(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const { business_whatsapp } = await request.json();
    const val = String(business_whatsapp || '').replace(/[^\d]/g, '');
    await pool.query(
      "INSERT INTO app_settings (key,value,updated_at) VALUES ('business_whatsapp',$1,NOW()) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()",
      [val]
    );
    await logAdminAction(a.admin, 'update_settings', 'Updated business WhatsApp number');
    return NextResponse.json({ success:true, business_whatsapp: val });
  } catch (e) {
    console.error('settings post', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
