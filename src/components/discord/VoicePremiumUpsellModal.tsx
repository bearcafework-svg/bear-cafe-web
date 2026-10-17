import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Crown,
  Headphones,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Tv,
  Users,
} from 'lucide-react';

interface VoicePremiumUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName?: string;
  serverIcon?: string | null;
  serverBanner?: string | null;
  voiceCount?: number;
}

export const KUMA_DISCORD_PURCHASE_URL = 'https://discord.gg/2XqGPgYDN8';

export function VoicePremiumUpsellModal({
  open,
  onOpenChange,
  serverName = 'เซิร์ฟเวอร์ดิสคอร์ด',
  serverIcon = null,
  voiceCount = 0,
}: VoicePremiumUpsellModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-2xl w-[95vw] p-0 overflow-hidden
          bg-[#FFFDF9] dark:bg-[#15110E]
          border border-[#EBDCD0] dark:border-[#2C221D]
          shadow-2xl rounded-3xl
        "
      >
        {/* Header Header Gradient */}
        <div className="relative p-6 sm:p-7 pb-5 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border-b border-[#EBDCD0]/60 dark:border-[#2C221D]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {serverIcon ? (
                <img
                  src={serverIcon}
                  alt={serverName}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white/80 dark:border-[#2C221D] shadow-md shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold shrink-0 shadow-xs">
                  <Headphones className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-2xs border-0">
                    <Crown className="w-3 h-3 mr-1" />
                    PREMIUM FEATURE
                  </Badge>
                  {voiceCount > 0 && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      มีสมาชิกคุยอยู่ {voiceCount} คน
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-[#5C3D2E] dark:text-[#EAD8C8] tracking-tight truncate">
                  การแสดงการลงห้องแบบเรียลไทม์
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground truncate">
                  ยกระดับหน้าดิสคอร์ดของ <strong>{serverName}</strong> บนสารบบ Bear Cafe
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Price Highlight Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border border-amber-500/30 dark:border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">สิทธิ์การแสดงห้องเสียงสดบนแดชบอร์ด</p>
                <p className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">
                  สมัครพรีเมี่ยมเพียง <span className="text-xl sm:text-2xl font-extrabold text-[#8C6239] dark:text-amber-200">59</span> บาท / เดือน
                </p>
              </div>
            </div>
            <Button
              size="sm"
              asChild
              className="w-full sm:w-auto h-9 rounded-xl font-bold bg-[#8C6239] hover:bg-[#734f2d] text-white shadow-xs shrink-0 cursor-pointer"
            >
              <a href={KUMA_DISCORD_PURCHASE_URL} target="_blank" rel="noopener noreferrer">
                <Crown className="w-3.5 h-3.5 mr-1.5" />
                ติดต่อซื้อพรีเมี่ยม
                <ExternalLink className="w-3 h-3 ml-1 opacity-80" />
              </a>
            </Button>
          </div>

          {/* Screenshot Preview Showcase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ภาพตัวอย่างเมื่อเปิดใช้งานสิทธิ์ Premium:
              </span>
              <span className="text-[11px] text-muted-foreground/80">ตัวอย่างการแสดงผลจริง</span>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#EBDCD0] dark:border-[#2C221D] shadow-md bg-stone-900 group">
              <img
                src="/images/live-voice-preview.png"
                alt="ตัวอย่างการแสดงห้องเสียงแบบเรียลไทม์"
                className="w-full h-auto object-cover filter brightness-[0.98] transition-transform duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2.5 left-3 right-3 text-white text-[11px] sm:text-xs drop-shadow flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  เห็นคนคุยไมค์ สตรีมจอ และปุ่มกดเข้าร่วมห้องได้ทันที
                </span>
                <span className="text-amber-300 font-bold hidden sm:inline">Live Sync 🐻</span>
              </div>
            </div>
          </div>

          {/* Benefits List */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>ดึงดูดคนใหม่เข้าห้อง</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                คนบนเว็บไซต์เห็นห้องเสียงที่กำลังคุยกันสดๆ ช่วยให้คนกล้ากดเข้าห้องเสียงมากขึ้น
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>เลือกหมวดหมู่ได้เอง</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                คำสั่ง <code>/setting-voice</code> ให้แอดมินเลือกแสดงได้สูงสุด 5 หมวดหมู่ ปลอดภัยสำหรับห้องสตาฟ
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-200">
                <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>เปิดห้องเสียงทันที</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ผู้ใช้กดปุ่มเข้าร่วมห้องบนเว็บ จะเปิดแอป Discord เด้งเข้าห้องเสียงนั้นได้โดยตรง
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-muted/30 border-t border-[#EBDCD0]/60 dark:border-[#2C221D]/60 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            💬 เข้าร่วมดิสคอร์ดเพื่อเปิดใช้งานสิทธิ์หรือสอบถามทีมงานได้ตลอด 24 ชม.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none text-xs rounded-xl"
            >
              ปิดหน้าต่าง
            </Button>
            <Button
              size="sm"
              asChild
              className="flex-1 sm:flex-none text-xs rounded-xl font-bold bg-[#8C6239] hover:bg-[#734f2d] text-white shadow-xs cursor-pointer"
            >
              <a href={KUMA_DISCORD_PURCHASE_URL} target="_blank" rel="noopener noreferrer">
                <Crown className="w-3.5 h-3.5 mr-1.5" />
                จอยดิสคอร์ดเพื่อซื้อ Premium (59฿)
                <ExternalLink className="w-3 h-3 ml-1 opacity-80" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
