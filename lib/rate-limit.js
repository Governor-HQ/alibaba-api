// lib/rate-limit.js — simple DB-backed fixed-window rate limiter.
// Works across serverless instances (state lives in Postgres, not memory).
// Fails OPEN on error so a DB hiccup never locks legitimate users out.
import pool from '@/lib/db';

export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function rateLimit(key, limit, windowSec) {
  try {
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const r = await pool.query(
      `INSERT INTO rate_buckets (k, bucket, count) VALUES ($1, $2, 1)
       ON CONFLICT (k, bucket) DO UPDATE SET count = rate_buckets.count + 1
       RETURNING count`,
      [key, bucket]
    );
    if (r.rows[0].count > limit) return { ok: false, retryAfter: windowSec };
    return { ok: true };
  } catch (e) {
    console.error('rate limit error', e);
    return { ok: true };
  }
}
