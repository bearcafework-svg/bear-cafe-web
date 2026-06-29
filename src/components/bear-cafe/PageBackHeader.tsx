import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageBackHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
}

export function PageBackHeader({ title, subtitle, backTo = '/' }: PageBackHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[hsl(var(--latte)/0.5)] dark:hover:bg-[hsl(var(--coffee)/0.3)] transition-colors"
        aria-label="กลับหน้าหลัก"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
      </button>
      <div>
        <h1 className="bear-h2-bold text-foreground leading-tight">{title}</h1>
        {subtitle && (
          <p className="bear-body-regular-medium text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
