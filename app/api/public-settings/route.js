// GET /api/public-settings — safe, public values only (no auth). Used by forgot-password.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
export async function GET() {
  try {
    const r = await pool.query("SELECT value FROM app_settings WHERE key='business_whatsapp'");
    return NextResponse.json({ success:true, business_whatsapp: r.rows[0]?.value || '' });
  } catch {
    return NextResponse.json({ success:true, business_whatsapp:'' });
  }
}
