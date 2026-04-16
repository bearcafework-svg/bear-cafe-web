import React, { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  showBack = false,
  backTo,
  actions,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex items-center justify-between mb-4 sm:mb-8">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-lg sm:text-2xl md:text-3xl truncate">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
