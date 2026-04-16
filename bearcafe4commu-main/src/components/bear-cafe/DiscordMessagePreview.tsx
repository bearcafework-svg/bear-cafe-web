import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconDisplay } from './IconDisplay';
import { Eye } from 'lucide-react';
import { getSessionActionButtonTemplate, type SessionMode } from '@/shared/sessionDiscordMessage';

interface DiscordMessagePreviewProps {
  username: string;
  avatarUrl?: string;
  categoryIcon: string;
  categoryName: string;
  duration: number;
  roleName?: string;
  roleEmoji?: string;
  discordRoleId?: string;
  voiceChannelName?: string;
  note?: string;
  hasVoiceChannel?: boolean;
  sessionMode?: SessionMode;
}

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({
  username,
  avatarUrl,
  categoryIcon,
  categoryName,
  roleName,
  roleEmoji,
  discordRoleId,
  voiceChannelName,
  note,
  hasVoiceChannel,
  sessionMode = 'dm',
}) => {
  // Format current time for preview
  const now = new Date();
  const formattedDate = now.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const actionButton = getSessionActionButtonTemplate(sessionMode);

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-[#36393f] text-white overflow-hidden">
      <CardHeader className="pb-2 border-b border-[#2f3136]">
        <CardTitle className="text-sm font-normal flex items-center gap-2 text-gray-400">
          <Eye className="w-4 h-4" />
          ตัวอย่างข้อความ Discord
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Bot header */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-bold">
            🐻
          </div>
          <div>
            <span className="font-semibold text-white">Bear Cafe</span>
            <span className="ml-1 text-[10px] px-1 py-0.5 bg-[#5865f2] rounded text-white">BOT</span>
          </div>
        </div>

        {/* Content with role mention and note */}
        <div className="text-sm">
          {discordRoleId && (
            <span className="text-[#99AAB5] bg-[#404675] px-1 rounded">@{roleName || 'Role'}</span>
          )}
          {note && <span className="ml-1 text-white">{note}</span>}
          {username && (
            <span className="ml-1 text-[#99AAB5] bg-[#2f3136] px-1 rounded">
              ||@{username}||
            </span>
          )}
        </div>

        {/* Embed */}
        <div className="border-l-4 border-[#FFE76F] bg-[#2f3136] rounded-r-md overflow-hidden">
          {/* Embed content */}
          <div className="p-3">
            {/* Title with thumbnail */}
            <div className="flex justify-between gap-3">
              <div className="flex-1">
                {/* Description with custom emoji */}
                <div className="mb-3">
                  <span className="text-lg font-semibold text-white">
                    ⭐︲<span className="bg-[#40444b] px-1 rounded font-mono text-sm">{username || 'ผู้ใช้'} กำลังหาเพื่อน!</span>
                  </span>
                </div>

                {/* Fields in grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {/* Category */}
                  <div>
                    <div className="text-[#b9bbbe] text-xs font-medium">📁 หมวดหมู่</div>
                    <div className="text-white flex items-center gap-1">
                      <IconDisplay icon={categoryIcon} fallback="📁" size="xs" />
                      {categoryName || 'ไม่ระบุ'}
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <div className="text-[#b9bbbe] text-xs font-medium">🏷️ บทบาท</div>
                    <div className="text-white">
                      {discordRoleId ? (
                        <span className="text-[#99AAB5] bg-[#404675] px-1 rounded">
                          <IconDisplay icon={roleEmoji} fallback="" size="xs" />
                          @{roleName || 'Role'}
                        </span>
                      ) : (
                        'ไม่ระบุ'
                      )}
                    </div>
                  </div>

                  {/* Date/Time */}
                  <div>
                    <div className="text-[#b9bbbe] text-xs font-medium">📅 วัน/เวลา</div>
                    <div className="text-white text-xs">{formattedDate}</div>
                  </div>

                  {/* Voice Status */}
                  <div>
                    <div className="text-[#b9bbbe] text-xs font-medium">🔊 สถานะ</div>
                    <div className="text-white text-xs">
                      {hasVoiceChannel && voiceChannelName ? (
                        <span className="text-[#8B9DFF]">#{voiceChannelName}</span>
                      ) : (
                        <span className="text-[#b9bbbe] italic">สมาชิกท่านนี้ยังไม่ลงห้อง ลองทักส่วนตัวดูนะคะ</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnail */}
              {avatarUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action row preview matches the Bot API payload used by the session sender. */}
        <div className="rounded-md border border-[#4f545c] bg-[#2f3136] p-2">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#b9bbbe]">Action Row</div>
          <div className="inline-flex items-center gap-2 rounded-md border border-[#5865f2]/40 bg-[#5865f2]/15 px-3 py-2 text-sm font-medium text-white">
            <span className="text-base leading-none">{sessionMode === 'voice_room' ? '🎙️' : '💬'}</span>
            <span>{actionButton.label}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
