import { cn } from '@/lib/utils';

interface CozyPageFooterProps {
  variant?: 'default' | 'checkin';
}

export function CozyPageFooter({ variant = 'default' }: CozyPageFooterProps) {
  const isCheckin = variant === 'checkin';

  return (
    <footer className="flex flex-col gap-4 border-t border-border px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="bear-h3-medium">
          <span className={cn(isCheckin ? 'text-[#89654A] dark:text-[#F5F5F5]' : 'dark:text-[#F5F5F5]')}>
            Bear
          </span>{' '}
          <span className={cn(isCheckin ? 'text-[#D7A042] dark:text-[#FAB97D]' : 'dark:text-[#FAB97D]')}>
            Cafe
          </span>
        </p>
        <p
          className={cn(
            'bear-body-small-regular',
            isCheckin ? 'text-[#94735C] dark:text-[#A1A1A1]' : 'dark:text-[#A1A1A1]',
          )}
        >
          2026 BEAR CAFE by Zeabiu. All rights reserved.
        </p>
      </div>
      <div>
        <p
          className={cn(
            'bear-body-small-regular',
            isCheckin ? 'text-[#94735C] dark:text-[#A1A1A1]' : 'dark:text-[#A1A1A1]',
          )}
        >
          All illustrations, UI designs, layouts, concepts, visual styles,
          and creative elements on this website are protected by copyright
          law.
        </p>
        <p
          className={cn(
            'bear-body-small-regular',
            isCheckin ? 'text-[#94735C] dark:text-[#A1A1A1]' : 'dark:text-[#A1A1A1]',
          )}
        >
          Unauthorized use, reproduction, imitation, or redistribution in
          any form is strictly prohibited.
        </p>
      </div>
    </footer>
  );
}
