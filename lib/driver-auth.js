// lib/driver-auth.js — verify a driver JWT from a request
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'alibaba_jwt_secret_change_this';

export function getDriverFromRequest(request) {
  const h = request.headers.get('authorization');
  if (!h) return null;
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    return d.role === 'driver' ? d : null;
  } catch {
    return null;
  }
}
