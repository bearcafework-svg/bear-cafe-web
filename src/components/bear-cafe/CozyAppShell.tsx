import { CozyNavbar } from '@/components/bear-cafe/CozyNavbar';
import { LoadingBear } from '@/components/bear-cafe/LoadingBear';
import { cn } from '@/lib/utils';

interface CozyAppShellProps {
  children: React.ReactNode;
  /** Optional overlays rendered above layout (e.g. GreenTeaWarningPopup, CooldownBox). */
  overlays?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  /** Scrollable content section className override. */
  contentClassName?: string;
}

export function CozyAppShell({
  children,
  overlays,
  isLoading = false,
  loadingMessage = 'กำลังโหลด...',
  contentClassName,
}: CozyAppShellProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingBear message={loadingMessage} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {overlays}
      <CozyNavbar />
      <main className={cn('flex-1 min-w-0 flex flex-col', contentClassName)}>
        {children}
      </main>
    </div>
  );
}
