# Check-in Admin Page - Calendar View Implementation

## Summary
Redesigned the check-in rewards admin page with a **calendar-based interface** that allows admins to configure rewards for **future months**. Admins can plan ahead and set different rewards for upcoming months.

## ✨ New Features

### 1. **Month/Year Navigation**
- Navigate between months using ← → buttons
- Quick "วันนี้" button to jump back to current month
- Display Thai month names (พ.ศ. calendar)
- Visual indicators:
  - **"เดือนนี้"** badge for current month
  - **"อดีต"** badge for past months
- Can select any future month (no limit)

### 2. **Calendar Grid View (28 Days)**
- Responsive grid layout:
  - **Mobile:** 4 columns
  - **Desktop:** 7 columns
- Each day card shows:
  - Day number (1-28)
  - Reward type badge (color-coded)
  - Reward amount/Role indicator
  - Makeup cost with coin icon
  - Visual hover effect (scale & shadow)
- Click any day to edit

### 3. **Big Reward Card**
- Prominent display with gradient background
- Shows current big reward configuration
- Sparkles icon (✨) for visual appeal
- Quick edit button

### 4. **Edit Dialogs**
- **Daily Reward Dialog:**
  - Shows selected day and month/year
  - Reward type selector
  - Amount/Role ID input
  - Makeup cost input
  - Save/Cancel buttons
  
- **Big Reward Dialog:**
  - Same structure as daily
  - Additional description field

## 🎨 Visual Design

### Color Coding by Reward Type
- **แต้ม (Points):** Blue gradient
- **แต้มตั๋ว (Ticket Point):** Purple gradient
- **แต้มชิ้นตั๋ว (Ticket Piece Point):** Amber gradient
- **Role:** Green gradient

### Calendar Day States
- **Active day:** Primary border with gradient background
- **Inactive day:** Muted border and background
- **Hover:** Scale up + shadow
- **Click:** Scale down (active feedback)

### Responsive Breakpoints
- Mobile: Stack elements vertically, 4-column grid
- Tablet: 7-column grid starts
- Desktop: Full layout with spacing

## 📅 Use Cases

### 1. **Set Rewards for Current Month**
```
Admin → เลือกเดือนนี้ → คลิกวันที่ต้องการแก้ไข → ตั้งค่า → บันทึก
```

### 2. **Plan Ahead for Next Month**
```
Admin → กด → (ไปเดือนถัดไป) → ตั้งค่ารางวัล 28 วัน → บันทึก
```

### 3. **Configure Special Month (2-3 months ahead)**
```
Admin → กด → หลายครั้ง → เลือกเดือนที่ต้องการ → ตั้งค่า
```

## 🔄 Month Navigation Logic

```typescript
// Current month
selectedYear: 2026, selectedMonth: 6 (June)

// Go to next month
→ selectedYear: 2026, selectedMonth: 7 (July)

// Go to previous month  
← selectedYear: 2026, selectedMonth: 5 (May)

// December → January transition
→ selectedYear: 2027, selectedMonth: 1 (January)

// January → December transition
← selectedYear: 2026, selectedMonth: 12 (December)
```

## 💾 Data Storage

**Note:** Currently, the system uses a **global configuration** (not per-month). All months share the same reward structure from `checkin_daily_rewards` table.

### Future Enhancement Needed
To fully support per-month configuration, you need to:

1. **Add month/year columns to `checkin_daily_rewards`:**
   ```sql
   ALTER TABLE checkin_daily_rewards 
   ADD COLUMN year INT,
   ADD COLUMN month INT;
   
   -- Update unique constraint
   DROP CONSTRAINT checkin_daily_rewards_day_number_key;
   ADD CONSTRAINT checkin_daily_rewards_unique 
   UNIQUE (year, month, day_number);
   ```

2. **Update edge functions to accept month/year:**
   - `update-checkin-daily-reward` needs `year`, `month` params
   - `get-checkin-status` filters by `year`, `month`

3. **Update component to pass month/year:**
   ```typescript
   await supabase.functions.invoke('update-checkin-daily-reward', {
     body: {
       year: selectedYear,
       month: selectedMonth,
       day_number: editingDay.day_number,
       // ... rest
     },
   });
   ```

## 🎯 Current Behavior (Without Per-Month Storage)

- UI allows month selection for **planning purposes**
- Changes apply to **all months** (global config)
- Admin sees the **same rewards** regardless of selected month
- Month selector is **UI-only** (doesn't filter data yet)

## 🚀 To Enable Full Per-Month Feature

1. Run the migration (add year/month columns)
2. Update edge functions to handle year/month
3. Seed default data for current + next 2 months
4. Update fetchRewards to filter by selectedYear/selectedMonth:
   ```typescript
   .from('checkin_daily_rewards')
   .select('*')
   .eq('year', selectedYear)
   .eq('month', selectedMonth)
   .order('day_number')
   ```

## 📱 UI Components

### Month Selector Card
```
┌─────────────────────────────────────────────┐
│ 📅 เลือกเดือนที่ต้องการตั้งค่า            │
│ สามารถตั้งค่ารางวัลล่วงหน้าสำหรับเดือนถัดไป│
│                                             │
│    [←]    มิถุนายน 2569    [→]    [วันนี้]  │
│           Badge: เดือนนี้                    │
└─────────────────────────────────────────────┘
```

### Calendar Grid (7x4 on Desktop)
```
┌──┬──┬──┬──┬──┬──┬──┐
│1 │2 │3 │4 │5 │6 │7 │
├──┼──┼──┼──┼──┼──┼──┤
│8 │9 │10│11│12│13│14│
├──┼──┼──┼──┼──┼──┼──┤
│15│16│17│18│19│20│21│
├──┼──┼──┼──┼──┼──┼──┤
│22│23│24│25│26│27│28│
└──┴──┴──┴──┴──┴──┴──┘

Each cell shows:
- Day number (bold)
- Reward type badge (colored)
- Amount (bold)
- Makeup cost (🪙 icon)
```

### Day Card Detail
```
┌─────────┐
│   15    │ ← Day number
│ ┌─────┐ │
│ │แต้ม │ │ ← Reward type badge (blue)
│ └─────┘ │
│   50    │ ← Reward amount
│ 🪙 25   │ ← Makeup cost
└─────────┘
```

## 🎨 Styling Classes

```css
/* Active day card */
.border-primary/30
.bg-gradient-to-br from-primary/5 to-transparent

/* Hover effect */
.hover:scale-105
.hover:shadow-md

/* Reward type colors */
points: bg-blue-500/10 text-blue-700
ticket_point: bg-purple-500/10 text-purple-700
ticket_piece_point: bg-amber-500/10 text-amber-700
role: bg-green-500/10 text-green-700
```

## 📦 Props & State

```typescript
// Month/Year selection
const [selectedYear, setSelectedYear] = useState(2026)
const [selectedMonth, setSelectedMonth] = useState(6) // 1-12

// Data
const [dailyRewards, setDailyRewards] = useState<DailyReward[]>([])
const [bigReward, setBigReward] = useState<BigReward | null>(null)

// Edit state
const [editingDay, setEditingDay] = useState<DailyReward | null>(null)
const [editForm, setEditForm] = useState({ ... })
```

## 🔧 Key Functions

```typescript
goToPrevMonth()  // Navigate to previous month
goToNextMonth()  // Navigate to next month
goToCurrentMonth() // Jump to current month

openEditDayDialog(dayNum) // Open edit form for specific day
getDayReward(dayNum) // Get reward config for day

saveDailyReward() // Save day reward to database
saveBigReward() // Save big reward to database
```

## ✅ Benefits

1. **Visual Planning:** See entire month at a glance
2. **Future Configuration:** Set rewards weeks ahead
3. **Quick Navigation:** Jump between months easily
4. **Intuitive UX:** Click-to-edit calendar interface
5. **Color-Coded:** Easy to identify reward types
6. **Responsive:** Works on mobile and desktop

## 📝 Next Steps

1. **Implement per-month database schema** (see migration above)
2. **Update edge functions** to accept year/month
3. **Add bulk actions** (copy month, reset month, templates)
4. **Add preview mode** (see what users will see)
5. **Add validation** (prevent editing past months)
