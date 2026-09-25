import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';

export default function InventoryPage() {
  return (
    <CozyAppShell>
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="text-6xl animate-bounce">🎒</div>
        <h1 className="text-3xl font-black text-foreground">กระเป๋าเก็บของ</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md">
          เร็วๆ นี้ — ระบบกระเป๋าเก็บของและไอเทมในตัวกำลังจะเปิดให้ใช้งานเร็วๆ นี้
        </p>
      </div>
    </CozyAppShell>
  );
}
