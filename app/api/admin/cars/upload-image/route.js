// app/api/admin/cars/upload-image/route.js
//
// POST — admin uploads a car photo. The browser reads + compresses the file
// and sends it here as base64 JSON (same shape as the receipts upload flow);
// we decode it, push it straight to the public 'car-images' Supabase Storage
// bucket, and hand back a permanent public URL. The admin panel then just
// saves that URL onto the car, same as if it had been pasted in.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { uploadCarImage, storageConfigured } from '@/lib/storage';

// The browser resizes + compresses the photo before it ever reaches us, so a
// real upload is typically well under 1MB regardless of the original file
// size. This is just a generous safety net, not a practical limit.
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request) {
  const _auth = await requireAdmin(request, 'cars_manage');
  if (!_auth.ok) return NextResponse.json({ success: false, error: _auth.error }, { status: _auth.status });

  try {
    if (!storageConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Image storage is not configured yet. Please contact support.' },
        { status: 503 }
      );
    }

    const { image_base64, content_type } = await request.json();
    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
    }

    const b64 = String(image_base64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) {
      return NextResponse.json({ success: false, error: 'Invalid image file.' }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Image too large (max 8MB).' }, { status: 413 });
    }

    const ct = content_type || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const path = `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const url = await uploadCarImage(path, buffer, ct);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Error uploading car image:', error);
    return NextResponse.json({ success: false, error: 'Could not upload image. Please try again.' }, { status: 500 });
  }
}
