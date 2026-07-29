-- Paste into the Supabase SQL editor. Safe to re-run.
-- Adds an optional video tour URL to cars, alongside the existing image_url.

ALTER TABLE cars ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Prereq: create a PUBLIC Storage bucket named exactly  car-videos
-- (Storage → New bucket → name "car-videos" → Public bucket: ON)
-- No RLS policies needed — uploads go through a short-lived signed URL
-- issued by the backend using the service-role key, and reads are public.
