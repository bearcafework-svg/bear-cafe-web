import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// DiscordServer shape (subset needed by this component)
interface DiscordServer {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  invite_status: 'valid' | 'expired' | 'unknown';
  invite_last_checked_at: string | null;
  [key: string]: unknown;
}

interface ExpiredServerCardProps {
  server: DiscordServer;
  onEditLink: (server: DiscordServer) => void;
}

/**
 * ExpiredServerCard — shown only to the server owner in the owner-specific
 * expired section. Displays a warning badge and an "แก้ไขลิงก์" button.
 * Requirements: 4.3, 5.1, 5.2
 */
export function ExpiredServerCard({ server, onEditLink }: ExpiredServerCardProps) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-orange-300/60 dark:border-orange-700/40 bg-white/60 dark:bg-card/60 backdrop-blur-xl shadow-sm opacity-80">
      {/* Banner (dimmed) */}
      <div className="relative h-20 overflow-hidden shrink-0">
        {server.banner_url ? (
          <img
            src={server.banner_url}
            alt=""
            className="w-full h-full object-cover grayscale opacity-50"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100/60 via-orange-50/30 to-red-100/40 dark:from-orange-950/30 dark:to-red-950/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-card/80 via-transparent to-transparent" />

        {/* Warning badge */}
        <div className="absolute top-2 right-2">
          <Badge
            className="text-[10px] bg-orange-500/90 text-white border-none backdrop-blur-md shadow-sm px-2 flex items-center gap-1"
            aria-label="ลิงก์หมดอายุ"
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            ลิงก์หมดอายุ
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 -mt-8 relative">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white dark:border-card shadow-md bg-white dark:bg-card mb-2 ring-2 ring-orange-300/30 grayscale opacity-70">
          {server.icon_url ? (
            <img
              src={server.icon_url}
              alt={server.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-200/40 to-red-200/40 flex items-center justify-center text-base font-bold text-orange-400">
              {server.name[0]}
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="font-bold text-sm truncate text-muted-foreground mb-1">{server.name}</h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2 mb-4">
          {server.description || 'ไม่มีคำอธิบาย'}
        </p>

        {/* Action */}
        <Button
          size="sm"
          className="w-full rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-md text-xs"
          onClick={() => onEditLink(server)}
          aria-label={`แก้ไขลิงก์สำหรับ ${server.name}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          แก้ไขลิงก์
        </Button>
      </CardContent>
    </Card>
  );
}

export default ExpiredServerCard;
