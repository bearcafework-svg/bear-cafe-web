import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkDeleteToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  itemLabel?: string;
  className?: string;
}

export function BulkDeleteToolbar({
  selectedCount,
  onDelete,
  onClear,
  isDeleting = false,
  itemLabel = 'รายการ',
  className,
}: BulkDeleteToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg mb-4 animate-in fade-in slide-in-from-top-2',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <span>
          เลือกแล้ว {selectedCount} {itemLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1 text-muted-foreground"
          disabled={isDeleting}
        >
          <X className="w-4 h-4" />
          ยกเลิก
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? 'กำลังลบ...' : `ลบ ${selectedCount} ${itemLabel}`}
        </Button>
      </div>
    </div>
  );
}
