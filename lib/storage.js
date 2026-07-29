// lib/storage.js — Supabase Storage helpers for the private 'receipts' bucket.
// Uses the service-role key (server-only) via the Storage REST API, so we add
// no extra npm dependency. Receipts are private; we hand out short-lived signed
// URLs for admin viewing only.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'receipts';

export function storageConfigured() {
  return Boolean(SB_URL && SB_KEY);
}

export async function uploadReceipt(path, buffer, contentType) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Storage upload failed (${res.status}): ${t}`);
  }
  return path;
}

export async function signReceipt(path, expiresIn = 3600) {
  if (!path) return null;
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // data.signedURL looks like "/object/sign/receipts/<path>?token=..."
  return `${SB_URL}/storage/v1${data.signedURL}`;
}
