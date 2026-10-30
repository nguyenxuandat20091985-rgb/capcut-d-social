-- Expand the private editor bucket to accept common mobile media formats.
-- Keep the bucket private and retain the existing 50 MiB per-object cap.
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]::text[]
where id = 'project-assets';
