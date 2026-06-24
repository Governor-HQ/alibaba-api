// GET /api/admin/me — validate token, return the admin's role + permissions
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const a = await requireAdmin(request);
  if (!a.ok) return NextResponse.json({ success:false, error:a.error }, { status:a.status });
  return NextResponse.json({ success:true, admin:a.admin });
}
