import { useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationToggle() {
  const { permission, isSupported, requestPermission } = useNotifications();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = async () => {
    setIsAnimating(true);
    await requestPermission();
    setTimeout(() => setIsAnimating(false), 500);
  };

  if (!isSupported) {
    return null;
  }

  const getIcon = () => {
    if (permission === 'granted') {
      return (
        <BellRing 
          className={`w-5 h-5 text-success ${isAnimating ? 'animate-wiggle' : ''}`} 
        />
      );
    }
    if (permission === 'denied') {
      return <BellOff className="w-5 h-5 text-muted-foreground" />;
    }
    return (
      <Bell 
        className={`w-5 h-5 text-muted-foreground ${isAnimating ? 'animate-wiggle' : ''}`} 
      />
    );
  };

  const getTooltipText = () => {
    if (permission === 'granted') return 'การแจ้งเตือนเปิดอยู่';
    if (permission === 'denied') return 'การแจ้งเตือนถูกปิดกั้น';
    return 'เปิดการแจ้งเตือน';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={permission === 'denied'}
          className={`
            relative w-10 h-10 rounded-xl 
            bg-cream/80 dark:bg-muted/80 backdrop-blur-sm 
            border border-latte dark:border-border
            shadow-sm hover:shadow-md
            transition-all duration-300 ease-out
            overflow-hidden
            group
            ${permission === 'granted' ? 'ring-2 ring-success/30' : ''}
          `}
        >
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-honey/20 to-transparent dark:from-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {getIcon()}
          
          {/* Pulse effect when enabled */}
          {permission === 'granted' && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
