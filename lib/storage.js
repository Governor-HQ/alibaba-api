// lib/storage.js — Supabase Storage helpers.
// Uses the service-role key (server-only) via the Storage REST API, so we add
// no extra npm dependency.
//
//   receipts    — private bucket. Uploaded server-side; viewed via short-lived signed URLs.
//   car-images  — public bucket. Uploaded server-side; returns a permanent public URL.
//   car-videos  — public bucket. Browser uploads directly using a short-lived signed
//                 upload URL (bypasses Vercel's serverless request-body size limit).
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RECEIPTS_BUCKET = 'receipts';
const CAR_IMAGES_BUCKET = 'car-images';
const CAR_VIDEOS_BUCKET = 'car-videos';

export function storageConfigured() {
  return Boolean(SB_URL && SB_KEY);
}

export async function uploadReceipt(path, buffer, contentType) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${RECEIPTS_BUCKET}/${encodeURIComponent(path)}`, {
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
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${RECEIPTS_BUCKET}/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // data.signedURL looks like "/object/sign/receipts/<path>?token=..."
  return `${SB_URL}/storage/v1${data.signedURL}`;
}

// Uploads a car photo straight through our own API (photos are small once the
// browser compresses them) and hands back a permanent public URL, ready to
// save onto the car record.
export async function uploadCarImage(path, buffer, contentType) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${CAR_IMAGES_BUCKET}/${encodeURIComponent(path)}`, {
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
  return `${SB_URL}/storage/v1/object/public/${CAR_IMAGES_BUCKET}/${path}`;
}

// Issues a short-lived signed upload URL so the browser can send a car video
// straight to Supabase Storage — never through our own serverless function,
// whose request-body limit (~4.5MB) video files routinely exceed.
export async function getCarVideoUploadUrl(path) {
  const res = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${CAR_VIDEOS_BUCKET}/${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Could not create video upload URL (${res.status}): ${t}`);
  }
  const data = await res.json();
  // data.url looks like "/object/upload/sign/car-videos/<path>?token=..."
  return {
    signedUrl: `${SB_URL}/storage/v1${data.url}`,
    token: data.token,
    publicUrl: `${SB_URL}/storage/v1/object/public/${CAR_VIDEOS_BUCKET}/${path}`,
  };
}