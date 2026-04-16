-- เปิด Realtime สำหรับตาราง profiles เพื่อให้ระบบแบนทำงานแบบ real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;