import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

function getDriver(request) {
  const h = request.headers.get('authorization');
  if (!h) return null;
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    return d.role === 'driver' ? d : null;
  } catch { return null; }
}

export async function GET(request) {
  const d = getDriver(request);
  if (!d) return NextResponse.json({ success:false, error:'Not authorized.' }, { status:401 });
  try {
    const r = await pool.query('SELECT id, name, phone, username, active FROM drivers WHERE id=$1', [d.driverId]);
    if (!r.rows.length || !r.rows[0].active) {
      return NextResponse.json({ success:false, error:'Account not found or disabled.' }, { status:403 });
    }
    return NextResponse.json({ success:true, driver:r.rows[0] });
  } catch { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
