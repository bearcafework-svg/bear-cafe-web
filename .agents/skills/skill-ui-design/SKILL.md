---
name: skill-ui-design
description: ออกแบบและพัฒนา UI/UX ตามมาตรฐาน Bear Cafe Design System (Cozy Cafe, Warm Dark #12100E, Tailwind, Lucide Icons) พร้อมเรียนรู้และอัปเดตสไตล์จากตัวอย่าง .tsx และคู่มือ UI ของผู้ใช้
---

# 🎨 Bear Cafe UI/UX Design System (@skill-ui-design)

ใช้ Skill นี้เมื่อต้องการสร้าง ปรับปรุง หรือรีดีไซน์หน้าจอและ Component บน `bear-cafe-web` ให้สวยงาม อบอุ่น มีชีวิตชีวา และตรงตามอัตลักษณ์ของร้านคาเฟ่หมี

---

## 🐻 อัตลักษณ์หลัก (Core Aesthetic: Cozy Cafe)
* **บรรยากาศ:** อบอุ่น สบายตา เหมือนนั่งเล่นในคาเฟ่ยามค่ำคืน (Warm Night Atmosphere), มีกลิ่นอายของน้ำผึ้งและขนมหวาน
* **ธีมสีพื้นหลังหลัก:** Warm Dark `#12100E` (หลีกเลี่ยงสีดำสนิท `#000000` และสีเทาเย็นแบบองค์กร)
* **รูปทรงและสัมผัส:** ขอบโค้งมน นุ่มนวล (Rounded `rounded-2xl`, `rounded-xl`), เงาเบาบางฟุ้งสวย (Soft Glow & Ambient Shadows)
* **สิ่งที่ต้องหลีกเลี่ยงโดยเด็ดขาด (Anti-Patterns):**
  - ❌ **Corporate SaaS:** หน้าตาเรียบแข็งแบบโปรแกรมสำนักงาน/แดชบอร์ดบริหารทั่วไป
  - ❌ **Cyberpunk / Neon:** สีฉูดฉาด ขอบเหลี่ยม แสงนีออนแสบตา
  - ❌ **Harsh Contrast:** ความคมชัดที่บาดตาเกินไป

---

## 🔄 กลไกการเรียนรู้และอัปเดตรูปแบบ UI (Dynamic Learning from User)
Skill นี้ถูกออกแบบมาให้พัฒนาความรู้ต่อเนื่องตามที่ผู้ใช้มอบหมาย:
1. **เมื่อผู้ใช้ส่งตัวอย่าง `.tsx`:**
   - ถอดรหัสโครงสร้าง ClassName ของ Tailwind, การจัด Grid/Flex, สัดส่วน Padding/Margin และสีที่ใช้
   - บันทึกเป็น Pattern ต้นแบบสำหรับนำไปใช้กับหน้าจออื่น ๆ ให้กลมกลืนเป็นเนื้อเดียวกัน
2. **เมื่อผู้ใช้ส่งไฟล์คู่มือ `.md` หรือข้อกำหนด UI:**
   - นำกฎและโทนสีที่ระบุมาผนวกรวมเข้ากับบริบทการออกแบบทันที
   - สามารถอัปเดตบันทึกสไตล์ใหม่ลงในส่วน **🎨 แหล่งรวม UI Patterns ที่เรียนรู้แล้ว** ทันที

---

## 🛠️ แนวทางการเขียนโค้ด UI (Technical Implementation)
* **Tailwind CSS & Token Usage:** ใช้ Utility classes ที่กระชับ อ่านง่าย และใช้ Token สีตาม `tailwind.config.ts`
* **Icons:** ใช้ไอคอนจาก `lucide-react` ที่มีความนุ่มนวลและสื่อความหมายชัดเจน
* **Micro-interactions:** มีเอฟเฟกต์ hover และ active เล็กน้อย เช่น `transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`
* **Responsive First:** ออกแบบให้ใช้งานได้ดีทั้งบนหน้าจอมือถือ (Mobile), แท็บเล็ต (iPad/Tablet) และหน้าจอคอมพิวเตอร์ (Desktop)
* **Touch Device Scrolling Standard (กฎสำคัญสำหรับ Dropdown/Select บน Mobile & iPad):**
  - **ห้ามใส่ `h-[var(--radix-select-trigger-height)]` บน Viewport:** เด็ดขาด เพราะจะล็อกความสูงกล่องเลื่อนเท่ากับปุ่ม Trigger (~36px-40px) ส่งผลให้ `react-remove-scroll` มองว่าการทัชแถวด้านล่างอยู่นอกขอบเขต และสั่ง `event.preventDefault()` ทำให้หน้าจอค้าง เลื่อนไม่ได้
  - **ใช้ `max-h-[inherit]` และ `touch-pan-y`:** บน `SelectPrimitive.Viewport`, `PopoverContent` และกล่องเลื่อนของ Dropdown ให้ใส่ `touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]` เสมอ เพื่อให้ WebKit บน iOS/iPadOS ทำงานร่วมกับระบบสัมผัสได้อย่างลื่นไหล
  - **ซ่อน Scroll Buttons ในโหมด Popper:** ปุ่มเลื่อนหัว-ท้าย (`SelectScrollUpButton`/`SelectScrollDownButton`) ให้แสดงเฉพาะเมื่อ `position !== "popper"` เพื่อไม่ให้แย่งพื้นที่และขัดขวางการปัดเลื่อนด้วยนิ้ว
  - **กฎเหล็กเมื่อ Dropdown อยู่ใน Modal/Dialog (Nested Overlays):** เมื่อ `RichSelect`, `Popover` หรือ `Select` เปิดอยู่ภายใน `Dialog` ตัว `RemoveScroll` ของ Dialog จะดักจับอีเวนต์ `touchmove` บน `document` และสั่ง `event.preventDefault()` เพราะคิดว่าเป็นทัชนอก Dialog! วิธีแก้คือต้องใส่ `e.stopPropagation()` บน native `touchmove` ของกล่อง Popover/Select เสมอ เพื่อหยุดการ bubble ไม่ให้ไปถึง `document` พร้อมกับใส่ Direct Touch Drag fallback ให้ลากนิ้วเลื่อนได้ทันที
* **Glassmorphism & Card Design:** ใช้การ์ดกึ่งโปร่งแสงผสมพื้นหลังเบลอ (เช่น `bg-[#1A1614]/80 backdrop-blur-md border border-[#2D2420]`)

---

## 🎨 แหล่งรวม UI Patterns ที่เรียนรู้แล้ว (Learned Patterns)
*(ส่วนนี้จะได้รับการอัปเดตเพิ่มขึ้นเรื่อย ๆ เมื่อผู้ใช้ส่งตัวอย่าง `.tsx` หรือเอกสาร UI เข้ามา)*

* **Base Card Container:**
  ```tsx
  <div className="bg-[#181412] border border-[#2A221E] rounded-2xl p-6 shadow-sm hover:border-[#3D322B] transition-colors">
    {/* Card Content */}
  </div>
  ```
* **Accent & Buttons (Honey Warm):**
  ```tsx
  <button className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium px-4 py-2 rounded-xl transition-all shadow-sm">
    {/* Button Text */}
  </button>
  ```
* **Option Dropdown & Select Standard (มาตรฐาน Dropdown สำหรับ Mobile, iPad และ PC):**
  - รองรับทั้งการหมุน Mouse Wheel บนคอมพิวเตอร์ และการใช้นิ้วปัดลาก (Touch Drag) บนโทรศัพท์มือถือและ iPad
  - โครงสร้างมาตรฐานสำหรับ Radix Select (`@/components/ui/select`):
    ```tsx
    {/* Select Content: ปรับความสูงตามพื้นที่หน้าจอจริง */}
    <SelectPrimitive.Content
      className="relative z-50 max-h-[var(--radix-select-content-available-height,24rem)] min-w-[8rem] overflow-hidden rounded-xl border bg-popover shadow-xl"
      position={position}
    >
      {/* ซ่อน Scroll Buttons เมื่อเป็น popper */}
      {position !== "popper" && <SelectScrollUpButton />}
      
      {/* Viewport: ปลดล็อกความสูง + เปิด Touch Pan และ WebKit Touch Scrolling */}
      <SelectPrimitive.Viewport
        className={cn(
          "p-1.5 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]",
          position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)] max-h-[inherit] overflow-y-auto"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>

      {position !== "popper" && <SelectScrollDownButton />}
    </SelectPrimitive.Content>
    ```
* **Rich Select Option Card (ตัวเลือกแบบการ์ดพรีเมียม + ซ่อน Scrollbar):**
  - ออกแบบสำหรับ Dropdown หรือตัวเลือกสำคัญ โดยมีการ์ดย่อยแสดงไอคอน/สี, ป้ายชื่อ, คำอธิบายย่อย และ Radio/Check indicator
  - **กฎการเลื่อน (Cozy Invisible Scroll):** รายการตัวเลือกที่ยาว ต้องเลื่อน Scroll ได้อย่างลื่นไหลโดยไม่ต้องเห็นแถบ Scrollbar กวนสายตา (ใช้ utility ซ่อน scrollbar เช่น `no-scrollbar` หรือ `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`)
  - **รองรับ Mobile Touch:** ต้องมี `touch-pan-y [-webkit-overflow-scrolling:touch] overscroll-contain` ในกล่องเลื่อนเสมอ
  ```tsx
  {/* Dropdown Container พร้อม Touch-Pan และซ่อน Scrollbar */}
  <div className="max-h-72 overflow-y-auto space-y-1.5 p-1.5 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {/* Rich Option Card Item (แตะลากได้ลื่นไหล ไม่แย่ง Gesture) */}
    <div className="flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer touch-pan-y bg-[#181412]/80 border-[#2A221E] hover:border-amber-500/40 hover:bg-amber-500/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
          {/* Icon หรือ Image เช่น ชาเขียว/ถ้วยกาแฟ */}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-200">ชื่อตัวเลือก</p>
          <p className="text-xs text-stone-400">คำอธิบายย่อยสั้นๆ</p>
        </div>
      </div>
      {/* Radio indicator */}
    </div>
  </div>
  ```
* **GlowCard / Spotlight Card (การ์ดแสงสปอตไลต์ตามเคอร์เซอร์ & ปุ่ม Glowing Honey):**
  - ใช้สำหรับหน้าโชว์ผลงาน รายการเซิร์ฟเวอร์ หรือการ์ดฟีเจอร์เด่น (`@/components/ui/spotlight-card`)
  - โครงสร้าง: Dual-layer radial gradient โดยคำนวณตำแหน่งเมาส์ผ่าน CSS variable `--glow-x`, `--glow-y` ทำให้ขอบและพื้นหลังการ์ดเรืองแสงนวลตาตามตำแหน่ง Cursor
  - โทนสีเรืองแสง: Bear Cafe Warm Honey `rgba(245, 158, 11, 0.2)` บนพื้นหลัง Warm Dark `#15110E`/`#181412`
  - ปุ่มกด Glowing Honey:
    ```tsx
    <Button className="rounded-full bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 active:scale-95 transition-all border-0">
      เข้าดิสคอร์ด
    </Button>
    ```
* **Action Dropdown Menu (ปุ่มเมนูตัวเลือกประจำแถว / การ์ด):**
  - ใช้สำหรับรวมปุ่มการกระทำหลายปุ่มในตารางหรือการ์ด (เช่น แก้ไข, ทำซ้ำ, คัดลอก, ลบ) ให้เหลือปุ่ม `•••` หรือปุ่ม `Options` ป้องกันปุ่มเบียดกันจนล้นจอ (`@/components/ui/dropdown-menu`)
  - โทนสีและสไตล์: มุมโค้งมน `rounded-2xl`, พื้นหลังกึ่งโปร่งแสง `bg-white/95 dark:bg-[#181412]/95 backdrop-blur-xl`, ขอบสีอำพันจาง `border-[#2C221D]`, ไอเทมธรรมดาโฮเวอร์สีน้ำผึ้ง `hover:text-amber-500 hover:bg-amber-500/10`, และไอเทมอันตราย `variant: 'destructive'`
  - รูปแบบการเรียกใช้ (Simple Options API):
    ```tsx
    <DropdownMenu
      options={[
        { label: "แก้ไข", onClick: () => handleEdit(item), Icon: <Pencil className="h-4 w-4" /> },
        { label: "ทำซ้ำ", onClick: () => handleDuplicate(item), Icon: <Copy className="h-4 w-4" /> },
        { label: "ลบ", onClick: () => handleDelete(item), Icon: <Trash className="h-4 w-4" />, variant: "destructive" },
      ]}
    >
      ตัวเลือก
    </DropdownMenu>
    ```
* **Stacked List (ทำเนียบสมาชิกแบบการ์ดซ้อน & ลิ้นชักสปริงเปิด-ปิด):**
  - ออกแบบสำหรับทำเนียบสมาชิก ทีมงาน หรือผู้ได้รับสิทธิ์พิเศษ (`@/components/ui/stacked-list`)
  - **โครงสร้าง:**
    - ส่วนบน (Upper Section): แสดงรายการสมาชิกหลักหรือผู้มีบทบาทสำคัญ พร้อมช่องค้นหา, Avatar, ป้ายกำกับสิทธิ์สีสันสดใส และปุ่มเพิ่มสมาชิก
    - ลิ้นชักล่าง (Bottom Expandable Drawer): แถบการ์ดลอยด้านล่างพร้อมสถิติสมาชิกและ Avatar Stack (`+N`) ที่สามารถคลิกคลี่ออกเป็นหน้าต่างค้นหาและมอบหมายสิทธิ์แบบเต็มตัวได้ด้วยแอนิเมชัน Spring Physics (`framer-motion`)
  - โทนสีและสไตล์: ขอบมนโค้งมน `rounded-[32px]`, พื้นหลังกึ่งโปร่งแสง `bg-card/95 backdrop-blur-md`, ขอบ `border-border`, ซ่อนแถบเลื่อนตามกฎ Cozy Invisible Scroll
  - ตัวอย่างการเรียกใช้:
    ```tsx
    <StackedList
      title="สมาชิกที่มีสิทธิ์พิเศษ"
      drawerTitle="ทำเนียบสมาชิกทั้งหมด"
      activeMembers={activeMembers}
      allMembers={allMembers}
      onAddClick={openCreateDialog}
      onMemberClick={member => openPermModal(member)}
    />
    ```
* **Tags Selector (กล่องเลือกแท็กแบบแยกกล่องเลือก-กล่องคลัง + Spring Physics Motion):**
  - ออกแบบสำหรับการเลือกแท็ก หมวดหมู่ หรือตัวกรองหลายตัวพร้อมกันอย่างเป็นระเบียบและน่าใช้งาน (`@/components/ui/tags-selector`)
  - **โครงสร้าง:**
    - กล่องบน (Selected Pool): กล่องการ์ดมนแสดงแท็กที่เลือก พร้อมปุ่ม `X` สี Rose เพื่อลบออก เมื่อไม่มีแท็กที่เลือกจะมี Placeholder พร้อมไอคอน Sparkles
    - กล่องล่าง (Available Pool): คลังแท็กที่เหลือทั้งหมด เมื่อคลิกที่แท็ก ไอเทมจะวิ่งทะลุขึ้นไปจัดเรียงในกล่องบนอย่างนุ่มนวลด้วย Framer Motion (`layoutId` + Spring Animation)
    - รองรับทั้ง Multi-selection และ Single-selection (`maxSelected={1}`, `keepLatestOnly={true}`) โดยเมื่อผู้ใช้คลิกเลือกแท็กใหม่ ระบบจะสลับมาเลือกเฉพาะแท็กล่าสุดให้อัตโนมัติ (Auto-replace with latest tag) ป้องกันตัวเลือกสะสมเยอะเกินไป
    - **Single Latest Mode:** ในแถบตัวกรองหลัก จะแสดงเฉพาะชิปแท็กล่าสุดที่เลือก (Single Active Chip พร้อมปุ่ม `✕` เพื่อล้าง) แทนที่จะเรียงปุ่มทุกหมวดหมู่จนล้นจอ
  - โทนสีและสไตล์: มุมโค้งมน `rounded-2xl`, ขอบอบอุ่น `#EFE7DC` / Dark `#2C221D`, ชิปการ์ดโฮเวอร์สีน้ำผึ้งอำพัน `hover:bg-amber-500/15 active:scale-95`, ป้ายกำกับ "ล่าสุด" สีอำพัน
  - รูปแบบการเรียกใช้ (Single Latest Mode):
    ```tsx
    import { TagsSelector } from "@/components/ui/tags-selector";

    <TagsSelector
      tags={categories.map(c => ({ id: c.id, label: `${c.icon} ${c.name}` }))}
      selectedTags={activeTag ? [activeTag] : []}
      onTagsChange={(newTags) => setActiveTag(newTags.slice(-1)[0] || null)}
      maxSelected={1}
      keepLatestOnly={true}
      placeholder="คลิกเลือกแท็กด้านล่าง (จะสลับเป็นแท็กล่าสุดให้อัตโนมัติ)..."
    />
    ```

* **Admin Notification Toast Box (กล่องแจ้งเตือนมุมขวาล่างสำหรับระบบหลังบ้าน Admin):**
  - แทนที่การใช้ Default Toast สีแดง/ขาวแข็ง ๆ ของ Shadcn ด้วยกล่องแจ้งเตือนสไตล์ Bear Cafe Warm Dark (`@/components/admin/AdminNotificationToast`)
  - **โครงสร้างและการทำงาน:**
    - กลอยลอยมุมขวาล่าง (Floating Stack ลิมิต 4 กล่องพร้อมกัน)
    - พื้นหลัง Glassmorphism โค้งมน: `rounded-2xl dark:bg-[#1E1B18]/95 dark:backdrop-blur-md dark:border dark:border-white/10`
    - ไอคอน Badge สีชัดเจน: สำเร็จ (`#00C9A7`), ข้อผิดพลาด (`#FF3D71`), คำเตือน (`#FFB800`), ข้อมูล (`#1E86FF`)
    - แสดงชื่อหัวข้อ, เวลา ("เมื่อสักครู่") และคำอธิบายย่อยที่เป็นภาษาไทยธรรมชาติ สั้นกระชับ
  - **การเรียกใช้:**
    ```tsx
    import { useAdminNotification } from '@/components/admin/AdminNotificationToast';

    const { notify } = useAdminNotification();

    // ตัวอย่างการแจ้งเตือน
    notify.success('สร้างสิทธิ์สำเร็จ', 'เพิ่มสิทธิ์ใหม่เข้าสู่ระบบแล้ว');
    notify.error('เกิดข้อผิดพลาด', 'ไม่มีสิทธิ์บันทึกข้อมูลนี้');
    notify.warning('ข้อมูลไม่ครบถ้วน', 'พิมพ์ชื่อสิทธิ์ก่อนบันทึก');
    ```

* **Zero-Redundancy Form Input (ฟอร์มกรอกช่องเดียวจบสำหรับข้อมูลที่คำตอบตรงกับโจทย์):**
  - สำหรับเกมหรือโมดูลที่ค่าคำตอบตรงกับโจทย์ 100% เช่น เกมพิมพ์เร็ว (Game 6, 7), เติมคำ (Game 1, 2) หรือเกมฟังเสียง (Game 5, 11)
  - **หลักการออกแบบ:** ซ่อนช่องกรอก "เฉลยคำตอบ" ออกทันที ไม่สร้างความสับสนให้ผู้ใช้ที่ต้องเว้นว่างหรือพิมพ์ซ้ำ ขยายช่องกรอกโจทย์เป็นเต็มความกว้าง (`col-span-full`) พร้อมติด Badge สีเขียว `✨ ช่องเดียวจบ บันทึกคำตอบตรงกันอัตโนมัติ`
  - ฝั่ง State / Handler ให้เชื่อมโยงและบันทึก `answer = question` ให้อัตโนมัติเบื้องหลังอย่างราบรื่น

* **Live Duplicate Detection Banner (แบนเนอร์ตรวจจับข้อมูลซ้ำแบบเรียลไทม์):**
  - ใช้สำหรับการกรอกคำศัพท์, โค้ด หรือไอเทม เพื่อป้องกันข้อมูลซ้ำ (Duplicate Prevention) ในระบบหลังบ้าน
  - **การทำงาน:** ตรวจจับแบบ Debounce 300ms ค้นหาทั้งในแคช Memory และฐานข้อมูล Supabase ข้ามกลุ่มเกมที่แชร์คลังคำศัพท์ร่วมกัน (Shared Pool)
  - **UI/UX States:**
    - *ตรวจพบข้อมูลซ้ำ (Warning Card):* การ์ดขอบส้มอำพัน `bg-amber-500/10 border-amber-500/30` ระบุชัดเจนว่าซ้ำกับไอเทม ID อะไร, เกมไหน, ข้อความและคำตอบคืออะไร พร้อม Disable ปุ่มบันทึกทันที
    - *ข้อมูลไม่ซ้ำ (Success Chip):* ชิปการ์ดสีเขียว `bg-emerald-500/10 text-emerald-700` พร้อมไอคอน CheckCircle2 ระบุว่า "ไม่พบข้อมูลซ้ำในคลัง สามารถเพิ่มคำนี้ได้ทันที"
    - *กำลังตรวจสอบ (Loading Chip):* ชิปแสดงไอคอนหมุนพร้อมข้อความ "กำลังตรวจสอบข้อมูลซ้ำในคลัง..."

---

## ✍️ มาตรฐานข้อความภาษาไทย (Thai Natural Language & UX Copy)

### 🎯 วัตถุประสงค์ (Purpose)
ทำให้ข้อความภาษาไทยที่ AI สร้างขึ้นเป็นภาษาธรรมชาติ อ่านง่าย และเหมือนคนไทยเขียนให้คนไทยอ่าน

กฎนี้ใช้กับข้อความที่ผู้ใช้มองเห็นหรืออ่าน เช่น:
* UI / UX (ปุ่ม, Label, Tooltip, Modal, Notification, Error message, Success message, Empty state, Help text)
* Documentation, คำอธิบายฟีเจอร์, ข้อความของ Discord Bot, ข้อความประชาสัมพันธ์, ข้อความตอบกลับผู้ใช้
* Comment หรือคำอธิบายในโค้ดที่เป็นภาษาไทย

*(ไม่ใช้กฎนี้เพื่อเปลี่ยนชื่อ Variable, Function, Class, API, Database column, Table หรือ Technical term ที่ควรเป็นภาษาอังกฤษ)*

---

### 🐻 กฎเหล็กของภาษา (Core Rule)
เขียนภาษาไทยแบบที่ **"คนทำโปรเจกต์คุยกับผู้ใช้จริง"** จะเขียน

**ห้ามเขียนเหมือน:**
* ❌ เอกสารราชการ / คู่มือราชการ
* ❌ งานวิจัย / AI กำลังอธิบายให้ AI อีกตัว
* ❌ ภาษา Corporate ที่พยายามดูเป็นทางการเกินจริง
* ❌ ภาษาแปลตรงจากภาษาอังกฤษ (Translationese)
* ❌ ภาษา Technical ที่ไม่จำเป็น

> **เป้าหมาย:** สั้น + ชัด + เป็นธรรมชาติ + อ่านแล้วเข้าใจทันที (ถ้าคำธรรมดากับคำทางการสื่อความหมายได้เท่ากัน ให้ใช้คำธรรมดา)

---

### 1. หลีกเลี่ยงคำทางการโดยไม่จำเป็น

| หลีกเลี่ยง | ใช้แทน |
| :--- | :--- |
| ดำเนินการ | ทำ / กด / จัดการ |
| ดำเนินการตรวจสอบ | ตรวจสอบ / เช็ก |
| ดำเนินการต่อ | ทำต่อ / ไปต่อ |
| ดำเนินการอีกครั้ง | ลองใหม่ |
| ผู้ใช้งาน | ผู้ใช้ |
| การใช้งาน | การใช้ |
| การดำเนินการ | การทำงาน / การทำรายการ |
| ดังกล่าว | นี้ / นั้น / ตัดออก |
| รายการดังกล่าว | รายการนี้ |
| ข้อมูลดังกล่าว | ข้อมูลนี้ |
| ฟังก์ชันดังกล่าว | ฟังก์ชันนี้ |
| ในกรณีที่ | ถ้า |
| ภายหลังจาก | หลังจาก |
| ก่อนดำเนินการ | ก่อนทำ |
| เพื่อทำการ | เพื่อ |
| มีความประสงค์ | ต้องการ |
| โปรด | กรุณา / ลอง |
| กรุณาดำเนินการ | กรุณา... / ลอง... |
| ไม่สามารถดำเนินการได้ | ทำรายการนี้ไม่ได้ |
| ไม่สามารถทำการ...ได้ | ...ไม่ได้ |
| โปรดตรวจสอบ | เช็กอีกครั้ง |
| ตรวจสอบความถูกต้อง | เช็กข้อมูล |
| ทำการเพิ่ม | เพิ่ม |
| ทำการลบ | ลบ |
| ทำการแก้ไข | แก้ไข |
| ทำการบันทึก | บันทึก |
| ทำการค้นหา | ค้นหา |
| ทำการเชื่อมต่อ | เชื่อมต่อ |
| ทำการโหลด | โหลด |
| ทำการประมวลผล | ประมวลผล |
| อยู่ระหว่างการดำเนินการ | กำลังทำงาน |
| อยู่ระหว่างการประมวลผล | กำลังประมวลผล |
| เรียบร้อยแล้ว | เสร็จแล้ว |
| สำเร็จเรียบร้อยแล้ว | สำเร็จแล้ว |
| ไม่เป็นไปตามที่กำหนด | ไม่ตรงตามเงื่อนไข |
| ตามที่กำหนด | ตามเงื่อนไข |
| ในส่วนของ | เรื่อง / ส่วน |
| ในเบื้องต้น | เบื้องต้น / ตัดออก |
| ทั้งนี้ | ตัดออกถ้าไม่จำเป็น |
| อย่างไรก็ตาม | แต่ / ถึงอย่างนั้น |
| ดังนั้นจึง | ดังนั้น |
| เนื่องด้วย / เนื่องจากสาเหตุที่ | เพราะ |
| ส่งผลให้เกิด | ทำให้ |
| มีการ / ได้มีการ / จะมีการ | ใช้ประโยคตรง ๆ |

---

### 2. ตัดคำฟุ่มเฟือย
* ❌ ไม่ดี: `ระบบจะทำการตรวจสอบข้อมูลของผู้ใช้งานก่อนที่จะดำเนินการเพิ่มคะแนนให้กับผู้ใช้งาน`
* ✅ ดีกว่า: `ระบบจะเช็กข้อมูลก่อนเพิ่มคะแนน`
* ❌ ไม่ดี: `กรุณาดำเนินการตรวจสอบข้อมูลอีกครั้งเพื่อให้สามารถดำเนินการต่อไปได้`
* ✅ ดีกว่า: `เช็กข้อมูลอีกครั้งแล้วลองใหม่`
* ❌ ไม่ดี: `ระบบได้ทำการบันทึกข้อมูลของคุณเรียบร้อยแล้ว`
* ✅ ดีกว่า: `บันทึกข้อมูลแล้ว`

### 3. ใช้ประโยคสั้น
* ❌ ไม่ดี: `หากคุณต้องการเปลี่ยนชื่อของห้องดังกล่าว กรุณาดำเนินการกดปุ่มตั้งค่าที่อยู่บริเวณด้านบนเพื่อเข้าสู่หน้าการตั้งค่าห้องและดำเนินการแก้ไขชื่อห้องต่อไป`
* ✅ ดีกว่า: `อยากเปลี่ยนชื่อห้องใช่ไหม? กด ตั้งค่า ด้านบน แล้วแก้ชื่อได้เลย`

### 4. ใช้คำกริยาโดยตรง
* ❌ ไม่ดี: `ระบบจะทำการส่งข้อมูลไปยังเซิร์ฟเวอร์` ➔ ✅ ดีกว่า: `ระบบจะส่งข้อมูลไปยังเซิร์ฟเวอร์`
* ❌ ไม่ดี: `ระบบมีการตรวจสอบว่าผู้ใช้มีสิทธิ์ในการเข้าถึงหรือไม่` ➔ ✅ ดีกว่า: `ระบบเช็กว่าผู้ใช้มีสิทธิ์เข้าถึงหรือไม่`

### 5. หลีกเลี่ยง Passive Voice แปลตรงตัว
* ❌ ไม่ดี: `ข้อมูลของคุณถูกบันทึกเข้าสู่ระบบเรียบร้อยแล้ว` ➔ ✅ ดีกว่า: `บันทึกข้อมูลแล้ว`
* ❌ ไม่ดี: `ห้องถูกสร้างโดยระบบเรียบร้อยแล้ว` ➔ ✅ ดีกว่า: `สร้างห้องแล้ว` หรือ `ระบบสร้างห้องให้แล้ว`

### 6. ใช้ "คุณ" อย่างเป็นธรรมชาติ
* ใช้เมื่อพูดกับผู้ใช้โดยตรง เช่น `คุณยังไม่มีห้องส่วนตัว`, `คุณมีแต้มไม่พอ`
* ไม่ต้องใส่ทุกประโยคจนฟุ่มเฟือย:
  * ❌ ไม่ดี: `คุณสามารถกดปุ่มนี้เพื่อให้คุณสามารถเปลี่ยนชื่อของคุณได้`
  * ✅ ดีกว่า: `กดปุ่มนี้เพื่อเปลี่ยนชื่อ`

### 7. ใช้ "กด" แทน "ดำเนินการเลือก"
* ❌ ไม่ดี: `กรุณาดำเนินการเลือกตัวเลือกที่ต้องการ` ➔ ✅ ดีกว่า: `เลือกตัวเลือกที่ต้องการ`
* ❌ ไม่ดี: `ดำเนินการกดปุ่มยืนยัน` ➔ ✅ ดีกว่า: `กด ยืนยัน`

### 8. Error Message (ชัดเจน + มีทางแก้)
บอก 3 อย่าง: 1. เกิดอะไรขึ้น 2. เพราะอะไร 3. ผู้ใช้ทำอะไรต่อได้
* ❌ ไม่ดี: `ไม่สามารถดำเนินการตามคำขอของคุณได้ เนื่องจากเกิดข้อผิดพลาดในระบบ`
* ✅ ดีกว่า: `ทำรายการไม่ได้ ระบบมีปัญหาชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่`
* ถ้ารู้สาเหตุ: `แต้มไม่พอ ต้องมีอย่างน้อย 100 แต้มเพื่อใช้ฟังก์ชันนี้`

### 9. Success Message (สั้น กระชับ)
* ❌ ไม่ดี: `ระบบได้ดำเนินการบันทึกข้อมูลของคุณเรียบร้อยแล้ว`
* ✅ ใช้: `บันทึกแล้ว` / `บันทึกข้อมูลเรียบร้อย` / `สำเร็จ!`

### 10. Confirmation (ตรงไปตรงมา)
* ❌ ไม่ดี: `คุณมีความประสงค์ที่จะดำเนินการลบข้อมูลนี้หรือไม่?`
* ✅ ใช้: `ลบข้อมูลนี้ไหม?` หรือถ้าสำคัญมาก: `ต้องการลบข้อมูลนี้ใช่ไหม? เมื่อลบแล้วจะกู้คืนไม่ได้`

### 11. Empty State
* ❌ ไม่ดี: `ไม่พบข้อมูลที่ตรงตามเงื่อนไขการค้นหาของคุณ`
* ✅ ใช้: `ไม่พบข้อมูล` หรือ `ไม่พบข้อมูล ลองค้นหาด้วยคำอื่นดู`

### 12. Loading (สั้น ๆ)
* ✅ ใช้: `กำลังโหลด...`, `กำลังค้นหา...`, `กำลังบันทึก...`, `กำลังเชื่อมต่อ...`
* ❌ หลีกเลี่ยง: `ระบบกำลังดำเนินการประมวลผลข้อมูล กรุณารอสักครู่`

### 13. หลีกเลี่ยง "กรุณา" และ "โปรด" พร่ำเพรื่อ
* ❌ ไม่ดี: `กรุณากดปุ่มเพื่อดำเนินการต่อ` ➔ ✅ ดีกว่า: `กดปุ่มเพื่อไปต่อ`
* ❌ ไม่ดี: `โปรดตรวจสอบข้อมูลของคุณ` ➔ ✅ ดีกว่า: `เช็กข้อมูลอีกครั้ง`

### 14. Technical Terms: ใช้ทับศัพท์เมื่อเหมาะสม
* คำสากลใช้ภาษาอังกฤษได้: `API`, `Database`, `Server`, `Cache`, `Session`, `Token`, `Webhook`, `Build`, `Debug`, `Log`
* ❌ ไม่แปลฝืน: `กรุณาตรวจสอบพื้นที่จัดเก็บข้อมูลชั่วคราวของระบบ` ➔ ✅ เขียน: `ลองล้าง Cache แล้วทดสอบอีกครั้ง`
* ถ้าเป็นคำที่ User ทั่วไปไม่เข้าใจ ให้อธิบายเข้าใจง่าย:
  * ❌ ไม่ดี: `Session หมดอายุ กรุณาดำเนินการ Authentication ใหม่`
  * ✅ ดีกว่า: `เซสชันหมดอายุแล้ว ล็อกอินใหม่อีกครั้งเพื่อใช้งานต่อ`

### 15. บริบท Discord & Community (Bear Cafe Voice)
* ❌ ไม่ดี: `ระบบตรวจพบว่าคุณได้เข้าร่วมกิจกรรมดังกล่าวแล้ว`
* ✅ ใช้: `คุณเข้าร่วมกิจกรรมนี้ไปแล้ว` หรือ `คุณเข้าร่วมกิจกรรมนี้ไปแล้วนะ`
* ⚠️ ไม่ใส่ "นะคะ/นะครับ/ค่ะ/ครับ" ทุกประโยคจนรกรุงรัง
* ⚠️ Natural Thai ≠ Slang (หลีกเลี่ยงภาษาวัยรุ่นหรือเล่นมุก เช่น "แงงง ระบบพังอะ" ให้ใช้ "ระบบมีปัญหา ลองใหม่อีกครั้ง")

---

### 🚫 คำและประโยคที่มี "กลิ่น AI" (AI Smells Checklist)
**หลีกเลี่ยงคำเหล่านี้หากตัดออกแล้วความหมายไม่เปลี่ยน:**
* `อย่างไรก็ตาม`, `ทั้งนี้`, `ดังกล่าว`, `ในส่วนของ`, `ในกรณีดังกล่าว`, `ด้วยเหตุนี้`, `กล่าวคือ`, `เพื่อทำการ`, `เพื่อให้สามารถ`, `ดำเนินการ`, `ผู้ใช้งาน`, `ระบบดังกล่าว`, `ข้อมูลดังกล่าว`

**หลีกเลี่ยงประโยคเปิดแบบ AI:**
* ❌ ไม่ขึ้นต้น: `แน่นอน! จากข้อมูลที่คุณให้มา...`, `ได้เลยค่ะ! ในส่วนนี้เราสามารถ...`, `จากรายละเอียดข้างต้น...`
* ✅ เข้าประเด็นทันที: `ระบบแต้มส่วนนี้ปรับได้แบบนี้: ...`

---

### ⚖️ ลำดับความสำคัญ (Priority Order)
1. ความถูกต้องของระบบ
2. ความหมายของ Requirement (ห้ามเปลี่ยนความหมายหรือแต่งข้อมูลเพิ่ม)
3. ความเข้าใจง่าย
4. ความเป็นธรรมชาติของภาษา
5. ความสุภาพ
6. ความสวยงามของประโยค
7. ความเป็นทางการ

> 💡 **เป้าหมายสูงสุด:** "ถ้าคนอ่านไม่รู้ว่าข้อความนี้สร้างโดย AI ก็คือผ่าน"

---

## 📱 มาตรฐาน Touch Device Scrolling สำหรับ Dropdowns & Overlays (Mobile & iPad)
เมื่อออกแบบหรือใช้งาน Component ประเภท Dropdown, Popover, Select, Dialog หรือ Drawer บน Bear Cafe Web:
1. **ห้ามพึ่งพาแค่ CSS Utility เดี่ยวๆ:** บน iOS Safari และ iPadOS การใส่ `overflow-y-auto` หรือ `touch-action: pan-y` เพียงอย่างเดียวไม่สามารถเอาชนะ JavaScript `preventDefault()` ของ Radix UI Body Scroll Lock (`react-remove-scroll`) ได้
2. **Global Body Interceptor:** ทุก Overlay หรือ Dropdown ที่เป็น Portaled Content ต้องได้รับการคุ้มครองด้วย Global Touch Interceptor (`src/lib/touch-scroll-lock-fix.ts`) ซึ่งจะดักฟัง `touchmove` บนระดับ `document.body` ใน Bubbling phase และสั่ง `e.stopPropagation()` เพื่อป้องกันไม่ให้ Event ไหลไปถึง `document`
3. **Pointer-Events Override:** เมนูที่แสดงผลแบบ Portal เข้าสู่ `document.body` ต้องมีคลาสหรือ CSS Rule `pointer-events: auto !important` เพื่อป้องกันการสืบทอด `pointer-events: none` จาก Dialog แม่
4. **Viewport Sizing:** คอมโพเนนต์ประเภท Select Viewport ต้องไม่ถูกจำกัดความสูงไว้ที่ Trigger Height และต้องมี `min-h-0`, `max-h-[...]` และ `-webkit-overflow-scrolling: touch` เสมอ
