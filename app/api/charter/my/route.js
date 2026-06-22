// GET /api/charter/my — the logged-in user's charter bookings (by user_id or email)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

function getUserFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  try { return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET); }
  catch { return null; }
}

export async function GET(request) {
  const tokenUser = getUserFromToken(request);
  if (!tokenUser) {
    return NextResponse.json({ success: false, error: 'Please log in.' }, { status: 401 });
  }
  try {
    const u = await pool.query('SELECT id, email FROM users WHERE id = $1', [tokenUser.userId]);
    if (u.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
    const result = await pool.query(
      `SELECT * FROM charter_bookings
       WHERE user_id = $1 OR LOWER(contact_email) = LOWER($2)
       ORDER BY created_at DESC`,
      [u.rows[0].id, u.rows[0].email]
    );
    return NextResponse.json({ success: true, bookings: result.rows });
  } catch (error) {
    console.error('Charter my error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load bookings.' }, { status: 500 });
  }
}
