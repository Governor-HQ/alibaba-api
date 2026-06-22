// POST /api/driver/login { username, password } → driver JWT
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success:false, error:'Username and password required.' }, { status:400 });
    }
    const r = await pool.query('SELECT * FROM drivers WHERE username = $1', [username.toLowerCase().trim()]);
    if (r.rows.length === 0) {
      return NextResponse.json({ success:false, error:'Invalid username or password.' }, { status:401 });
    }
    const driver = r.rows[0];
    if (!driver.active) {
      return NextResponse.json({ success:false, error:'This driver account is disabled.' }, { status:403 });
    }
    const ok = await bcrypt.compare(password, driver.password_hash);
    if (!ok) {
      return NextResponse.json({ success:false, error:'Invalid username or password.' }, { status:401 });
    }
    // Driver token carries role:'driver' to distinguish from customer tokens
    const token = jwt.sign({ driverId: driver.id, username: driver.username, role: 'driver' }, JWT_SECRET, { expiresIn: '7d' });
    return NextResponse.json({
      success:true, token,
      driver: { id: driver.id, name: driver.name, phone: driver.phone, username: driver.username }
    });
  } catch (e) {
    console.error('Driver login error:', e);
    return NextResponse.json({ success:false, error:'Something went wrong.' }, { status:500 });
  }
}
