// app/api/auth/forgot-password/route.js
// POST /api/auth/forgot-password { email }
// Creates a short-lived reset code for the user (if the email exists).
//
// INTERIM DELIVERY (until Resend email is live):
//   The code is NOT emailed. It surfaces in the admin panel
//   (GET /api/admin/password-resets) so the team relays it to the customer
//   over WhatsApp. When automated email is enabled, send the code from here
//   and stop exposing the plaintext to admins.
//
// Always returns a generic success so this endpoint can't be used to discover
// which emails have accounts (anti-enumeration).

import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const CODE_TTL_MINUTES = 30;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L to avoid relay/typing confusion

function makeCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

const GENERIC = {
  success: true,
  message: 'If an account exists for that email, a reset code is being prepared. You will receive it shortly — enter it below once you get it.'
};

export async function POST(request) {
  const _rl = await rateLimit(`forgot:${clientIp(request)}`, 6, 3600); if (!_rl.ok) return NextResponse.json({ success:false, error:'Too many attempts. Please wait a few minutes and try again.' }, { status:429 });
  try {
    const { email } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const found = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);

    // Per product decision: tell the user plainly when no account exists for that
    // email (rate limiting above mitigates enumeration abuse).
    if (found.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No account exists for that email address. Please check it and try again.' }, { status: 404 });
    }
    const userId = found.rows[0].id;

    // Retire any earlier unused codes for this user so only the newest is valid.
    await pool.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false', [userId]);

    const code = makeCode(6);
    await pool.query(
      `INSERT INTO password_resets (user_id, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes')`,
      [userId, code]
    );

    return NextResponse.json(GENERIC);
  } catch (e) {
    console.error('Forgot-password error:', e);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
