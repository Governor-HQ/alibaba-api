// lib/ref.js — cryptographically strong, unguessable payment references.
// Keeps the service prefix (ALB-PAY-/ALB-BUS-/ALB-CHT-) so webhook/verify
// branching still works, but appends 72 bits of randomness so references
// can't be enumerated (this is what protects the verify endpoint from
// leaking other customers' bookings).
import crypto from 'crypto';
export function makeRef(prefix) {
  return `${prefix}${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(9).toString('hex').toUpperCase()}`;
}
