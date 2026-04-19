import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'ค้นหา...', className }: SearchBarProps) {
  return (
    <div className={cn('relative flex-1 min-w-[180px]', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 h-9 rounded-lg bg-background border-border/60 focus-visible:ring-1 transition-colors"
      />
      {value && (
        <Button
          variant="ghost" size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 active:scale-95 transition-all duration-150 rounded-md"
          onClick={() => onChange('')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
