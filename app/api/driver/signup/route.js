// POST /api/driver/signup { name, phone, username, password, invite }
// Invite-gated self-registration. Creates a driver in 'pending' status that an
// admin must approve before the driver can log in.
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { name, phone, username, password, invite } = await request.json();

    if (!name || !phone || !username || !password || !invite) {
      return NextResponse.json({ success:false, error:'All fields, including the invite code, are required.' }, { status:400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success:false, error:'Password must be at least 6 characters.' }, { status:400 });
    }

    // Validate the invite code against the current shared code.
    const s = await pool.query('SELECT invite_code FROM driver_settings ORDER BY id LIMIT 1');
    const validCode = s.rows[0]?.invite_code;
    if (!validCode || String(invite).trim().toUpperCase() !== validCode.toUpperCase()) {
      return NextResponse.json({ success:false, error:'Invalid invite code. Please ask the admin for a current signup link.' }, { status:403 });
    }

    const uname = username.toLowerCase().trim();
    const exists = await pool.query('SELECT id FROM drivers WHERE username = $1', [uname]);
    if (exists.rows.length) {
      return NextResponse.json({ success:false, error:'That username is taken. Please choose another.' }, { status:409 });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO drivers (name, phone, username, password_hash, status, active)
       VALUES ($1,$2,$3,$4,'pending',false)`,
      [name.trim(), phone.trim(), uname, hash]
    );

    return NextResponse.json({
      success:true,
      message:'Account created. It is now pending admin approval — you will be able to log in once approved.'
    }, { status:201 });
  } catch (e) {
    console.error('Driver signup error:', e);
    return NextResponse.json({ success:false, error:'Something went wrong. Please try again.' }, { status:500 });
  }
}
