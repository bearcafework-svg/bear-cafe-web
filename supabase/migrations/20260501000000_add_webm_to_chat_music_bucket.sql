-- Allow audio/webm (Opus) uploads — needed for ffmpeg.wasm converted files
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/webm'
]
WHERE id = 'chat-music';
