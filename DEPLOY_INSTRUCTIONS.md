# 🚀 Deploy Edge Functions to Supabase

## ปัญหา: 401 Unauthorized

Edge Functions ที่แก้ไขแล้วยังไม่ได้ deploy ไปยัง Supabase
ต้อง deploy ด้วยตนเองผ่าน Supabase CLI

---

## ✅ วิธี Deploy:

### 1. ติดตั้ง Supabase CLI (ถ้ายังไม่มี)

**Windows (PowerShell):**
```powershell
scoop install supabase
```

**หรือ:**
```powershell
npm install -g supabase
```

**macOS/Linux:**
```bash
brew install supabase/tap/supabase
```

---

### 2. Login เข้า Supabase

```bash
supabase login
```

---

### 3. Link โปรเจกต์

```bash
supabase link --project-ref orbxyyjpvpbqwfssnyeq
```

---

### 4. Deploy Functions

**Deploy ทั้งหมด:**
```bash
supabase functions deploy
```

**หรือ Deploy เฉพาะ function:**
```bash
supabase functions deploy get-role-members
supabase functions deploy resolve-discord-invite
```

---

### 5. ตรวจสอบ Environment Variables

ตรวจสอบว่า function มี env vars ครบ:

```bash
supabase secrets list
```

**ถ้าไม่มี ให้ set:**
```bash
supabase secrets set DISCORD_BOT_TOKEN=your_bot_token
supabase secrets set DISCORD_GUILD_ID=your_guild_id
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
```

---

### 6. ทดสอบ Function

**ทดสอบ get-role-members:**
```bash
curl -X POST \
  https://orbxyyjpvpbqwfssnyeq.supabase.co/functions/v1/get-role-members \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"role_id":"123456789"}'
```

**ทดสอบ resolve-discord-invite:**
```bash
curl -X POST \
  https://orbxyyjpvpbqwfssnyeq.supabase.co/functions/v1/resolve-discord-invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"invite_url":"https://discord.gg/abc123","category_id":"uuid"}'
```

---

## 🔍 Debug Logs

ดู logs ของ function:

```bash
supabase functions logs get-role-members
supabase functions logs resolve-discord-invite
```

---

## ⚠️ หมายเหตุ:

1. **ต้อง deploy ทุกครั้งที่แก้ไข code**
2. **Environment variables ต้อง set ผ่าน `supabase secrets set`**
3. **ไม่สามารถ deploy ผ่าน Git push ได้** (ต้องใช้ CLI)
4. **Function จะใช้เวลา 1-2 นาทีในการ deploy**

---

## 📝 Files ที่ต้อง Deploy:

- ✅ `supabase/functions/get-role-members/index.ts`
- ✅ `supabase/functions/resolve-discord-invite/index.ts`

---

## 🎯 หลังจาก Deploy แล้ว:

1. ลองเข้า `/admin/contracts` → เปิด personal_role card → ดูว่าแสดงสมาชิกได้หรือไม่
2. ลองเข้า `/discord-servers` → กดเพิ่มเซิร์ฟเวอร์ → ดูว่าเพิ่มได้หรือไม่

ถ้ายังติด 401 ให้ดู logs:
```bash
supabase functions logs resolve-discord-invite --tail
```
