// middleware.js — dynamic CORS allowlist for /api/*.
// Reflects the request Origin only when it matches an allowed pattern,
// instead of the previous wide-open "*". Also answers OPTIONS preflight.
import { NextResponse } from 'next/server';

const ALLOWED = [
  /^https:\/\/alibaba-logistics\.netlify\.app$/,        // production frontend
  /^https:\/\/[a-z0-9-]+--alibaba-logistics\.netlify\.app$/, // Netlify deploy previews
  /^https:\/\/([a-z0-9-]+\.)?alibabalogistics\.ng$/,    // future custom domain
  /^http:\/\/localhost(:\d+)?$/,                        // local dev
];

export function middleware(request) {
  const origin = request.headers.get('origin') || '';
  const allowed = ALLOWED.some((re) => re.test(origin));

  if (request.method === 'OPTIONS') {
    const h = new Headers();
    if (allowed) {
      h.set('Access-Control-Allow-Origin', origin);
      h.set('Vary', 'Origin');
      h.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      h.set('Access-Control-Max-Age', '86400');
    }
    return new NextResponse(null, { status: 204, headers: h });
  }

  const res = NextResponse.next();
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  return res;
}

export const config = { matcher: '/api/:path*' };
