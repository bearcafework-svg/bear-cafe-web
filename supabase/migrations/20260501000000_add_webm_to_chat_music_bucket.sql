-- Allow audio/webm (Opus) and audio/ogg uploads — needed for browser MediaRecorder converted files
-- Chrome/Edge encodes to audio/webm, Firefox may encode to audio/ogg
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus'
]
WHERE id = 'chat-music';
