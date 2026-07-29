// GET /api/public-settings — safe, public values only (no auth).
// Used by forgot-password (WhatsApp) and the bank-transfer page (bank details).
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
const KEYS = ['business_whatsapp', 'bank_name', 'bank_account_number', 'bank_account_name', 'payments_online_enabled', 'payments_transfer_enabled'];
const DEFAULT_ON = ['payments_online_enabled', 'payments_transfer_enabled'];
export async function GET() {
  try {
    const r = await pool.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [KEYS]);
    const out = {};
    for (const k of KEYS) out[k] = DEFAULT_ON.includes(k) ? 'on' : '';
    for (const row of r.rows) out[row.key] = row.value || '';
    return NextResponse.json({ success: true, ...out });
  } catch {
    return NextResponse.json({ success: true, business_whatsapp: '', bank_name: '', bank_account_number: '', bank_account_name: '' });
  }
}
