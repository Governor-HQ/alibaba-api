// app/api/admin/cars/video-upload-url/route.js
//
// POST — admin requests permission to upload a car video. We don't touch the
// video's bytes at all here: we just ask Supabase Storage for a short-lived
// signed upload URL and hand it back. The browser then uploads the file
// directly to Supabase (see uploadCarVideoToStorage() in admin.html), which
// sidesteps Vercel's serverless request-body size limit entirely — that
// limit is a real ceiling around ~4.5MB and video files routinely blow past
// it, so proxying the bytes through our own API route isn't an option.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getCarVideoUploadUrl, storageConfigured } from '@/lib/storage';

const ALLOWED_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };

export async function POST(request) {
  const _auth = await requireAdmin(request, 'cars_manage');
  if (!_auth.ok) return NextResponse.json({ success: false, error: _auth.error }, { status: _auth.status });

  try {
    if (!storageConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Video storage is not configured yet. Please contact support.' },
        { status: 503 }
      );
    }

    const { content_type } = await request.json().catch(() => ({}));
    const ext = ALLOWED_EXT[content_type] || 'mp4';
    const path = `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { signedUrl, token, publicUrl } = await getCarVideoUploadUrl(path);

    return NextResponse.json({ success: true, signedUrl, token, publicUrl });
  } catch (error) {
    console.error('Error creating car video upload URL:', error);
    return NextResponse.json({ success: false, error: 'Could not start video upload. Please try again.' }, { status: 500 });
  }
}
