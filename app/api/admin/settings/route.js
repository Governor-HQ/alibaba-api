// /api/admin/settings  GET: read (any admin) · POST: update business + bank settings (super only)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

const KEYS = ['business_whatsapp', 'bank_name', 'bank_account_number', 'bank_account_name', 'payments_online_enabled', 'payments_transfer_enabled'];
const DEFAULT_ON = ['payments_online_enabled', 'payments_transfer_enabled'];

export async function GET(request) {
  const a = await requireAdmin(request);
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  const r = await pool.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [KEYS]);
  const out = {};
  for (const k of KEYS) out[k] = DEFAULT_ON.includes(k) ? 'on' : '';
  for (const row of r.rows) out[row.key] = row.value || '';
  return NextResponse.json({ success:true, ...out });
}

export async function POST(request) {
  const a = await requireAdmin(request, 'admins_manage');
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  try {
    const body = await request.json();
    const updates = [];
    if ('business_whatsapp' in body)     updates.push(['business_whatsapp', String(body.business_whatsapp || '').replace(/[^\d]/g, '')]);
    if ('bank_name' in body)             updates.push(['bank_name', String(body.bank_name || '').trim().slice(0, 80)]);
    if ('bank_account_number' in body)   updates.push(['bank_account_number', String(body.bank_account_number || '').replace(/[^\d]/g, '').slice(0, 20)]);
    if ('bank_account_name' in body)     updates.push(['bank_account_name', String(body.bank_account_name || '').trim().slice(0, 120)]);
    if ('payments_online_enabled' in body)   updates.push(['payments_online_enabled', body.payments_online_enabled === 'on' || body.payments_online_enabled === true ? 'on' : 'off']);
    if ('payments_transfer_enabled' in body) updates.push(['payments_transfer_enabled', body.payments_transfer_enabled === 'on' || body.payments_transfer_enabled === true ? 'on' : 'off']);
    for (const [k, v] of updates) {
      await pool.query(
        "INSERT INTO app_settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()",
        [k, v]
      );
    }
    await logAdminAction(a.admin, 'update_settings', 'Updated business / bank settings');
    const r = await pool.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [KEYS]);
    const out = {};
    for (const k of KEYS) out[k] = DEFAULT_ON.includes(k) ? 'on' : '';
    for (const row of r.rows) out[row.key] = row.value || '';
    return NextResponse.json({ success:true, ...out });
  } catch (e) {
    console.error('settings post', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
