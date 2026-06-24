// app/api/auth/reset-password/route.js
// POST /api/auth/reset-password { email, code, password }
// Verifies a reset code and sets a new password. Auto-logs the user in on success.

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';
const MAX_ATTEMPTS = 5;

export async function POST(request) {
  try {
    const { email, code, password } = await request.json();

    if (!email || !code || !password) {
      return NextResponse.json({ success: false, error: 'Email, code and new password are required.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    // Generic message — don't reveal whether the email exists.
    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or expired reset code.' }, { status: 400 });
    }
    const user = userRes.rows[0];

    // Newest active (unused, unexpired) reset code for this user.
    const rs = await pool.query(
      `SELECT * FROM password_resets
       WHERE user_id = $1 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (rs.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or expired reset code. Please request a new one.' }, { status: 400 });
    }
    const reset = rs.rows[0];

    if (reset.attempts >= MAX_ATTEMPTS) {
      await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);
      return NextResponse.json({ success: false, error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    }

    const submitted = String(code).trim().toUpperCase();
    if (submitted !== reset.code.toUpperCase()) {
      const newAttempts = reset.attempts + 1;
      const exhausted = newAttempts >= MAX_ATTEMPTS;
      await pool.query('UPDATE password_resets SET attempts = $1, used = $2 WHERE id = $3', [newAttempts, exhausted, reset.id]);
      return NextResponse.json({
        success: false,
        error: exhausted ? 'Too many incorrect attempts. Please request a new code.' : 'Incorrect code. Please check and try again.'
      }, { status: 400 });
    }

    // Correct code — set the new password and consume the code.
    const password_hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, user.id]);
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    return NextResponse.json({
      success: true,
      message: 'Password updated. You are now signed in.',
      token,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone }
    });
  } catch (e) {
    console.error('Reset-password error:', e);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
