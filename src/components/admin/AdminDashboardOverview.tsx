import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Flag, ShieldAlert, Settings, ChevronRight, RefreshCw, Coffee, Sparkles, AlertCircle
} from 'lucide-react';
import { AdminPageDef } from '@/lib/admin-pages';
import { cn } from '@/lib/utils';
import { useAdminNotification } from '@/components/admin/AdminNotificationToast';
import { fetchWithOfflineCache } from '@/lib/offline-cache';

interface AdminDashboardOverviewProps {
  onNavigate: (tabId: string) => void;
  visibleItems: (AdminPageDef & { icon?: React.ElementType })[];
  username?: string | null;
}

const PAGE_DESCRIPTIONS: Record<string, string> = {
  // สินค้าและบริการ
  'product-catalog': 'จัดการสินค้า ไอเทม และราคาในคลังสินค้าคาเฟ่',
  'contracts': 'สัญญาเช่าห้องแชทและข้อตกลงการให้บริการของคาเฟ่',
  'trading-history': 'ประวัติการซื้อขาย แลกเปลี่ยนไอเทม และเหรียญรางวัล',
  'checkin-rewards': 'ตั้งค่าไอเทมและแต้มรางวัลสำหรับการเช็กอินประจำวัน',
  'redeem-codes': 'สร้างโค้ดของรางวัลสำหรับสมาชิกนำไปแลกรับของ',
  'campaigns': 'โปรโมชัน จัดการโฆษณา และสิทธิพิเศษของร้าน',
  'gachapon': 'จัดการตู้กาชาปอง รางวัล และเรทการสุ่ม',

  // ดูแลชุมชน
  'users': 'จัดการสมาชิก กำหนดสิทธิ์ และควบคุมสถานะการแบน',
  'tag-warn': 'ตรวจสอบและจัดการประวัติการแท็กเตือนสมาชิก',
  'banned-name': 'จัดการชื่อต้องห้าม คัดกรองความปลอดภัยของระบบ',
  'reports': 'รายงานความประพฤติและคำขอปลดแบนประวัติเตือน',
  'healing-messages': 'ตรวจสอบและอนุมัติข้อความบนกระดานให้กำลังใจ',
  'role-transfer': 'โอนย้ายสิทธิ์ยศบทบาทของสมาชิก',
  'bulk-role-manage': 'จัดการกลุ่มยศของสมาชิกจำนวนมากพร้อมกัน',
  'daily-quests': 'จัดการภารกิจและเควสประจำวันของสมาชิก',

  // สื่อและคอนเทนต์
  'discord-servers': 'จัดการ ตรวจสอบ และอนุมัติเซิร์ฟเวอร์พาร์ทเนอร์',
  'banners': 'อัปโหลดและอัปเดตภาพแบนเนอร์โฆษณาในคาเฟ่',
  'sticky-messages': 'จัดการข้อความปักหมุดติดหนึบในช่องแชท',
  'dm-broadcast': 'ส่งข้อความบรอดแคสต์ตรงเข้า DM ผ่านบอท',
  'minigames': 'จัดการมินิเกม ทายคำ และคำร้องขอแก้คลังเกม',
  'ai-assistant': 'จัดการคลังความรู้ กฎระเบียบร้าน และ Sticker Triggers ของ AI พี่หมี',
  'kuma-tenants': 'จัดการระบบบอท Kuma สำหรับเซิร์ฟเวอร์ลูกค้า',

  // ระบบและการตั้งค่า
  'overview': 'ภาพรวมแดชบอร์ด สถิติ และการเข้าถึงระบบ',
  'heal-jai': 'จัดการโปรเจกต์และแคมเปญฮีลใจของร้าน',
  'permissions': 'ควบคุมสิทธิ์การเข้าถึงหน้าต่างต่าง ๆ ของทีมงาน',
  'manage-staff': 'จัดการรายชื่อ บทบาท และสถานะของทีมงาน',
  'non-transferable-roles': 'กำหนดบทบาทยศ Discord ที่ห้ามไม่ให้โอนย้าย',
  'roles-to-delete': 'ยศ Discord ที่จะถูกนำออกโดยอัตโนมัติเมื่อทำการย้าย',
};

const GROUP_LABELS: Record<string, string> = {
  products: 'สินค้าและบริการ (Products & Services)',
  community: 'ดูแลชุมชนและความสงบเรียบร้อย (Community & Moderation)',
  content: 'สื่อ คอนเทนต์ และกิจกรรม (Content & Activities)',
  system: 'ระบบและการตั้งค่า (System & Settings)',
};

export function AdminDashboardOverview({ onNavigate, visibleItems, username }: AdminDashboardOverviewProps) {
  const { notify } = useAdminNotification();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeReports: 0,
    pendingWarnings: 0,
    pendingServers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const result = await fetchWithOfflineCache('admin_overview_stats', async () => {
        const [
          { count: usersCount },
          { count: reportsCount },
          { count: warningsCount },
          { count: serversCount }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('tag_warn_cancel_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from('discord_servers' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

        return {
          totalUsers: usersCount || 0,
          activeReports: reportsCount || 0,
          pendingWarnings: warningsCount || 0,
          pendingServers: serversCount || 0,
        };
      });

      if (result.data) {
        setStats(result.data);
      }
      setIsOffline(result.isOffline);
      if (result.cachedAt) {
        setCachedTime(new Date(result.cachedAt).toLocaleTimeString('th-TH'));
      }
    } catch (err) {
      console.error('Error fetching admin dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats().then(() => {
      notify.info('อัปเดตข้อมูลสถิติแล้ว', 'ดึงข้อมูลสถิติล่าสุดจากฐานข้อมูลสำเร็จ');
    });
  };

  // Group pages by category (excluding overview itself)
  const menuGroups = visibleItems
    .filter(item => item.id !== 'overview')
    .reduce<Record<string, AdminPageDef[]>>((acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      {isOffline && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>โหมดสำรองออฟไลน์ (Offline Snapshot):</strong> กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้ในแคช {cachedTime ? `(อัปเดตล่าสุด ${cachedTime})` : ''} เนื่องจากฐานข้อมูล Supabase กำลังมีโหลดสูงหรือจำกัดการเชื่อมต่อ
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-7 px-2.5 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg shrink-0"
          >
            ลองเชื่อมต่อใหม่
          </Button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-accent/5 to-peach/10 border border-primary/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 z-10">
          <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            สวัสดีคุณ {username || 'Barista'}!
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            ยินดีต้อนรับกลับสู่ร้าน Bear Cafe วันนี้ต้องการปรับแต่งข้อมูลส่วนใด หรือมีรายงานชิ้นใหม่ที่ต้องให้ดูแลจัดการไหมคะ?
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-xl gap-2 bg-background/50 hover:bg-background transition-colors text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            อัปเดตข้อมูล
          </Button>
          <div className="text-primary/60 hidden md:block animate-pulse duration-3000"><Coffee className="w-8 h-8" /></div>
        </div>
        {/* Soft decorative background circles */}
        <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute left-1/3 -top-20 w-36 h-36 rounded-full bg-accent/5 blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="border border-border/60 rounded-2xl bg-card hover:shadow-sm transition-shadow duration-300">
          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">สมาชิกทั้งหมด</span>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? '...' : stats.totalUsers.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Active Reports */}
        <Card className="border border-border/60 rounded-2xl bg-card hover:shadow-sm transition-shadow duration-300">
          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                รายงานความประพฤติ
                {!loading && stats.activeReports > 0 && (
                  <Badge variant="destructive" className="px-1 py-0 h-4 min-w-4 text-[9px] flex items-center justify-center animate-pulse">
                    ใหม่
                  </Badge>
                )}
              </span>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? '...' : stats.activeReports}
              </p>
            </div>
            <div className={cn(
              "w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              stats.activeReports > 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
            )}>
              <Flag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending TagWarn Cancels */}
        <Card className="border border-border/60 rounded-2xl bg-card hover:shadow-sm transition-shadow duration-300">
          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">คำขอยกเลิก TagWarn</span>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? '...' : stats.pendingWarnings}
              </p>
            </div>
            <div className={cn(
              "w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              stats.pendingWarnings > 0 ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
            )}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Discord Servers */}
        <Card className="border border-border/60 rounded-2xl bg-card hover:shadow-sm transition-shadow duration-300">
          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">เซิร์ฟเวอร์รออนุมัติ</span>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? '...' : stats.pendingServers}
              </p>
            </div>
            <div className={cn(
              "w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
              stats.pendingServers > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
            )}>
              <Settings className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Menu Categories Panel */}
      <div className="space-y-8">
        {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map((groupKey) => {
          const items = menuGroups[groupKey];
          if (!items || items.length === 0) return null;

          return (
            <div key={groupKey} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <div className="w-1.5 h-4 rounded-full bg-primary" />
                <h3 className="text-sm md:text-base font-semibold text-foreground tracking-wide">
                  {GROUP_LABELS[groupKey]}
                </h3>
                <Badge variant="outline" className="text-[10px] ml-1 bg-background/50">
                  {items.length} รายการ
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {items.map((item) => {
                  const desc = PAGE_DESCRIPTIONS[item.id] || 'ระบบบริการส่วนข้อมูลร้านกาแฟ';
                  const ItemIcon = item.icon || Settings;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className="group text-left border border-border/60 rounded-2xl bg-card/75 p-4 hover:bg-card hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/5 hover:border-amber-500/40 dark:hover:border-amber-500/30 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer flex flex-col justify-between min-h-[8.5rem]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-stone-950 transition-all duration-200">
                              <ItemIcon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {item.label}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all shrink-0 mt-2" />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-0.5">
                          {desc}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70 bg-muted/60 group-hover:bg-primary/10 group-hover:text-primary rounded-md px-1.5 py-0.5 transition-colors">
                          {item.id}
                        </span>
                        {item.ownerOnly && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                            Owner
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
