# สถานะการแก้ไข ✅

## แก้ไขเสร็จแล้ว

### 1. ✅ Login ช้า (Turnstile Optimization)
- ลด fallback threshold จาก 2 errors → 1 error
- ลด timeout จาก 15s → 5s
- เพิ่ม immediate bypass เมื่อเกิด error ครั้งแรก

### 2. ✅ Edge Functions Build Errors
- แปลง `serve()` → `Deno.serve()` ทุกไฟล์:
  - discord-auth
  - discord-callback
  - discord-member-count
  - discord-voice-state
  - discord-voice-webhook

### 3. ✅ Role Ban Enhancement
- เพิ่ม `banned_role_name` ใน error response
- ปรับ discord-callback ให้คืน role name ที่ถูกแบน

### 4. ✅ ลบ Unused Code
- ไม่พบโค้ดที่ไม่ได้ใช้งาน (VoiceState interface ที่ไม่ได้ใช้ถูกลบแล้ว)

---

## สรุปการเปลี่ยนแปลง

| ไฟล์ | การแก้ไข |
|------|---------|
| TurnstileWidget.tsx | ลด threshold, timeout, immediate bypass |
| discord-auth/index.ts | ใช้ Deno.serve() |
| discord-callback/index.ts | ใช้ Deno.serve(), เพิ่ม banned_role_name |
| discord-member-count/index.ts | ใช้ Deno.serve() |
| discord-voice-state/index.ts | ใช้ Deno.serve(), ลบ unused interface |
| discord-voice-webhook/index.ts | ใช้ Deno.serve() |

### RoleChip Conditional Description

```typescript
<div className="space-y-1">
  <span className="text-sm font-semibold text-foreground">{name}</span>
  {description && (
    <p className="text-xs text-muted-foreground line-clamp-2">
      {description}
    </p>
  )}
</div>
```

