import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export const COZY_MODAL_SHELL = cn(
  'relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 p-5 sm:gap-5 md:p-7',
  'bg-[#FDFAF7] border-[#F4EEE5]',
  'dark:bg-[#121212] dark:border-[#51443A]',
  'animate-in fade-in zoom-in-95 duration-200',
);

export const COZY_MODAL_BUTTON = cn(
  'w-full rounded-full border px-8 py-2 bear-body-small-medium sm:w-auto md:bear-body-regular-medium',
  'bg-[#FAF2E4] border-[#EACB8F] text-[#46362A]',
  'hover:bg-[#F7E6C5] hover:border-[#D7A042]',
  'dark:bg-[#242424] dark:border-[#51443A] dark:text-[#E9E6E2]',
  'dark:hover:bg-[#333333] dark:hover:border-[#51443A]',
  'transition-all duration-200',
);

/** Locks body scroll and listens for Escape while modal is open. */
export function useModalLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);
}

interface CozyModalShellProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
  buttonLabel?: string;
}

export function CozyModalShell({
  open,
  onClose,
  titleId,
  children,
  buttonLabel,
}: CozyModalShellProps) {
  useModalLock(open, onClose);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="ปิด"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={COZY_MODAL_SHELL}>
        {children}
        {buttonLabel && (
          <button type="button" onClick={onClose} className={COZY_MODAL_BUTTON}>
            {buttonLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
