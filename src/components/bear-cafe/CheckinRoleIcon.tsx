import { cn } from '@/lib/utils';
import { TeaBagColorIcon } from '@/icon/outline/TeaBagColorIcon';
import type { OutlineIconProps } from '@/icon/types';

type CheckinRoleIconProps = {
  roleIcon?: string | null;
  size: OutlineIconProps['size'];
  className?: string;
};

export function CheckinRoleIcon({ roleIcon, size, className }: CheckinRoleIconProps) {
  const isImageUrl = roleIcon?.startsWith('http') || roleIcon?.startsWith('blob:');

  if (isImageUrl) {
    return (
      <img
        src={roleIcon}
        alt=""
        className={cn('object-contain rounded bg-transparent', className)}
      />
    );
  }

  if (roleIcon) {
    return (
      <span className={cn('flex items-center justify-center', className)}>
        {roleIcon}
      </span>
    );
  }

  return <TeaBagColorIcon size={size} className={className} />;
}
