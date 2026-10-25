import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserMenuData {
  discord_id?: string | null;
  username?: string | null;
  discord_username?: string | null;
  nickname?: string | null;
  name?: string | null;
}

interface UserClickMenuProps {
  user: UserMenuData;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function UserClickMenu({
  user,
  children,
  className,
  align = 'start',
}: UserClickMenuProps) {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const discordId = user.discord_id?.trim() || null;

  // Filter raw username: must NOT be just the discord_id, nor fallback like User-1234, nor '-'
  const rawUsername = (user.discord_username || user.username || user.name || '').trim();
  const isValidUsername = Boolean(
    rawUsername &&
    rawUsername !== discordId &&
    !/^User-\d+$/i.test(rawUsername) &&
    rawUsername !== '-'
  );
  const username = isValidUsername ? rawUsername : null;

  // Filter nickname: must NOT be empty, nor equal to discord_id, nor equal to username, nor '-'
  const rawNickname = user.nickname?.trim() || '';
  const isValidNickname = Boolean(
    rawNickname &&
    rawNickname !== discordId &&
    rawNickname !== username &&
    rawNickname !== '-'
  );
  const nickname = isValidNickname ? rawNickname : null;

  const fallbackCopy = (value: string, label: string, key: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus({ preventScroll: true });
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (success) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
        toast({
          title: `คัดลอก ${label} สำเร็จ 🎉`,
          description: value,
        });
      } else {
        throw new Error('execCommand returned false');
      }
    } catch (e) {
      toast({
        title: 'คัดลอกไม่สำเร็จ',
        description: 'กรุณาอนุญาตการเข้าถึงคลิปบอร์ดในเบราว์เซอร์',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = (value: string, label: string, key: string) => {
    if (!value) return;

    // Use setTimeout(0) to execute after Radix finishes closing its unmount cycle
    setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value)
          .then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 1500);
            toast({
              title: `คัดลอก ${label} สำเร็จ 🎉`,
              description: value,
            });
          })
          .catch((err) => {
            console.warn('[UserClickMenu] navigator.clipboard error, trying fallback:', err);
            fallbackCopy(value, label, key);
          });
      } else {
        fallbackCopy(value, label, key);
      }
    }, 0);
  };

  const hasAnyData = Boolean(username || nickname || discordId);
  if (!hasAnyData) {
    return <span className={className}>{children}</span>;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'group/usermenu inline-flex items-center text-left cursor-pointer transition-all hover:opacity-85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm',
            className
          )}
          title="คลิกเพื่อคัดลอกข้อมูลผู้ใช้"
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="min-w-[210px] p-1.5 shadow-xl bg-card border-border/80 rounded-2xl z-50 animate-in fade-in-0 zoom-in-95"
      >
        <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground px-2 py-1 flex items-center justify-between uppercase tracking-wider">
          <span>ข้อมูลสมาชิก (คลิกเพื่อคัดลอก)</span>
          <Sparkles className="w-3 h-3 text-[#8C6239]" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Username Option */}
        {username && (
          <DropdownMenuItem
            onSelect={() => handleCopy(username, 'Username', 'username')}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-muted/80 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {copiedKey === 'username' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-primary shrink-0 opacity-70 group-hover:opacity-100" />
              )}
              <span className="font-semibold text-foreground truncate">
                กดเพื่อคัดลอก Username
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono max-w-[85px] truncate shrink-0 text-right">
              {username}
            </span>
          </DropdownMenuItem>
        )}

        {/* Nickname Option */}
        {nickname && (
          <DropdownMenuItem
            onSelect={() => handleCopy(nickname, 'Nickname', 'nickname')}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-muted/80 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {copiedKey === 'nickname' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-amber-500 shrink-0 opacity-70 group-hover:opacity-100" />
              )}
              <span className="font-semibold text-foreground truncate">
                กดเพื่อคัดลอก Nickname
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono max-w-[85px] truncate shrink-0 text-right">
              {nickname}
            </span>
          </DropdownMenuItem>
        )}

        {/* DiscordID Option */}
        {discordId && (
          <DropdownMenuItem
            onSelect={() => handleCopy(discordId, 'DiscordID', 'discord_id')}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-muted/80 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {copiedKey === 'discord_id' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-blue-500 shrink-0 opacity-70 group-hover:opacity-100" />
              )}
              <span className="font-semibold text-foreground truncate">
                กดเพื่อคัดลอก DiscordID
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono max-w-[85px] truncate shrink-0 text-right">
              {discordId}
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
