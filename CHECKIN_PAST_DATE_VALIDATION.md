# Past Date Validation - Check-in Calendar

## Summary
Added validation to **disable editing of past dates** in the check-in rewards calendar. Admins can only configure rewards for today and future dates.

## Changes Made

### 1. **Date Validation Function**
```typescript
const isDayInPast = (dayNum: number) => {
  const selectedDate = new Date(selectedYear, selectedMonth - 1, dayNum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selectedDate < today;
};
```

This function:
- Creates a date from selected year, month, and day
- Compares with today's date (time stripped)
- Returns `true` if the day is in the past

### 2. **Visual Indicators**

#### **Calendar Day Cards**
Past days are now:
- **Disabled** - Cannot be clicked
- **Grayed out** - 50% opacity
- **Cursor changed** - Shows `cursor-not-allowed`
- **No hover effect** - Removed scale/shadow on hover

```typescript
className={cn(
  'aspect-square rounded-lg border-2 transition-all duration-200',
  'flex flex-col items-center justify-center gap-1 p-2',
  isPast
    ? 'border-border/50 bg-muted/30 opacity-50 cursor-not-allowed'
    : 'hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer',
  // ...
)}
```

#### **Past Month Warning Banner**
When viewing a past month, displays:
```
⚠️ เดือนนี้เป็นเดือนที่ผ่านมาแล้ว - ไม่สามารถแก้ไขรางวัลได้
```
- Amber background with border
- Alert triangle icon
- Appears below calendar header

### 3. **Helper Text Update**
Updated calendar description:
```
คลิกที่วันเพื่อแก้ไขรางวัลและค่า Makeup • วันที่ผ่านไปแล้วไม่สามารถแก้ไขได้
```

## Visual States

### **Normal (Future/Today) Day**
```
┌────────────┐
│     15     │ ← Bold, full color
│  ┌──────┐  │
│  │ แต้ม │  │ ← Colored badge
│  └──────┘  │
│     50     │ ← Bold amount
│  🪙 25     │ ← Makeup cost
└────────────┘
✓ Clickable
✓ Hover scale + shadow
✓ Active scale down
```

### **Past Day**
```
┌────────────┐
│     3      │ ← Grayed out text
│  ┌──────┐  │
│  │ แต้ม │  │ ← Faded badge
│  └──────┘  │
│     50     │ ← Faded amount
│  🪙 25     │ ← Faded cost
└────────────┘
✗ Not clickable (disabled)
✗ No hover effects
✗ 50% opacity
✗ cursor: not-allowed
```

### **Past Month Banner**
```
┌──────────────────────────────────────────────┐
│ ⚠️ เดือนนี้เป็นเดือนที่ผ่านมาแล้ว          │
│    ไม่สามารถแก้ไขรางวัลได้                   │
└──────────────────────────────────────────────┘
Amber background (#f59e0b with 10% opacity)
Amber border
Dark text for visibility
```

## Behavior Examples

### **Current Month (June 2026)**
```
Today: June 15, 2026

Days 1-14:   ✗ Disabled (past)
Day 15:      ✓ Enabled (today)
Days 16-28:  ✓ Enabled (future)
```

### **Future Month (July 2026)**
```
Today: June 15, 2026

Days 1-28:   ✓ All enabled (future month)
```

### **Past Month (May 2026)**
```
Today: June 15, 2026

Days 1-28:   ✗ All disabled (past month)
Warning:     ⚠️ Banner shown
```

## Edge Cases Handled

### **Month Transition**
```
Today: June 30, 2026 (last day of month)

June 2026:
- Day 30: ✓ Enabled (today)

July 2026:
- Days 1-28: ✓ All enabled (next month)
```

### **Year Transition**
```
Today: December 31, 2026

December 2026:
- Day 31: ✓ Enabled (today)

January 2027:
- Days 1-28: ✓ All enabled (next year)
```

### **Time of Day**
The validation uses **midnight as cutoff**:
```typescript
today.setHours(0, 0, 0, 0);
```

So even if it's 11:59 PM on June 15:
- June 15: ✓ Still enabled (today)
- June 14: ✗ Disabled (past)

## Implementation Details

### **Button Disabled State**
```typescript
<button
  onClick={() => !isPast && openEditDayDialog(dayNum)}
  disabled={isPast}
  className={cn(
    // base styles
    isPast
      ? 'border-border/50 bg-muted/30 opacity-50 cursor-not-allowed'
      : 'hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer',
    // ...
  )}
>
```

- `onClick` only fires if `!isPast`
- `disabled` attribute prevents native click
- CSS styles provide visual feedback

### **Conditional Rendering**
```typescript
{isPastMonth && (
  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4" />
      เดือนนี้เป็นเดือนที่ผ่านมาแล้ว - ไม่สามารถแก้ไขรางวัลได้
    </p>
  </div>
)}
```

Warning only shows when entire month is in the past.

## User Experience Flow

### **Scenario 1: Admin tries to edit past day**
1. Admin navigates to June 2026
2. Today is June 15, 2026
3. Admin clicks on Day 10 (past day)
4. **Nothing happens** - button is disabled
5. Visual feedback: grayed out, no cursor change

### **Scenario 2: Admin views past month**
1. Admin navigates to May 2026 (← button)
2. "อดีต" badge shows in month selector
3. ⚠️ Warning banner appears
4. All 28 days are grayed out
5. No days are clickable

### **Scenario 3: Admin configures future month**
1. Admin navigates to July 2026 (→ button)
2. All days show normal colors
3. All days are clickable
4. No warnings shown
5. Can freely configure all rewards

## CSS Classes

### **Past Day**
```css
.border-border/50        /* Faded border */
.bg-muted/30            /* Subtle background */
.opacity-50             /* 50% transparency */
.cursor-not-allowed     /* X cursor on hover */
```

### **Active Day (not past)**
```css
.hover:scale-105        /* Grow on hover */
.hover:shadow-md        /* Shadow on hover */
.active:scale-95        /* Shrink on click */
.cursor-pointer         /* Pointer cursor */
```

### **Warning Banner**
```css
.bg-amber-500/10        /* Light amber background */
.border-amber-500/20    /* Amber border */
.text-amber-700         /* Dark amber text (light mode) */
.dark:text-amber-400    /* Lighter amber (dark mode) */
```

## Benefits

1. ✅ **Prevents accidental edits** - Can't modify past rewards
2. ✅ **Clear visual feedback** - Easy to see what's editable
3. ✅ **Better UX** - No confusing errors when clicking past days
4. ✅ **Consistent behavior** - Same rules across all months
5. ✅ **Future planning** - Focus on upcoming rewards

## Testing Checklist

- [ ] Past days are grayed out and disabled
- [ ] Current day is clickable
- [ ] Future days are clickable
- [ ] Past month shows warning banner
- [ ] Current month works normally
- [ ] Future month works normally
- [ ] Month transition (end of month) works correctly
- [ ] Year transition (Dec → Jan) works correctly
- [ ] Hover effects only on future/today days
- [ ] Cursor changes appropriately (pointer vs not-allowed)
