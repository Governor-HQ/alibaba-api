// POST /api/driver/login { username, password } → driver JWT
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

export async function POST(request) {
  const _rl = await rateLimit(`driverlogin:${clientIp(request)}`, 10, 300); if (!_rl.ok) return NextResponse.json({ success:false, error:'Too many attempts. Please wait a few minutes and try again.' }, { status:429 });
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
    const ok = await bcrypt.compare(password, driver.password_hash);
    if (!ok) {
      return NextResponse.json({ success:false, error:'Invalid username or password.' }, { status:401 });
    }

    // Lifecycle gate (checked AFTER the password so we don't reveal account state to wrong guesses).
    const status = driver.status || 'approved';
    if (status === 'pending') {
      return NextResponse.json({ success:false, error:'Your account is awaiting admin approval. Please try again once it has been approved.' }, { status:403 });
    }
    if (status === 'suspended') {
      return NextResponse.json({ success:false, error:'Your account has been suspended. Please contact the admin.' }, { status:403 });
    }
    if (status !== 'approved' || driver.active === false) {
      return NextResponse.json({ success:false, error:'This driver account is not active.' }, { status:403 });
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
