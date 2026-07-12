import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Flag, ShieldAlert, Settings, ChevronRight, RefreshCw, Coffee, Sparkles
} from 'lucide-react';
import { AdminPageDef } from '@/lib/admin-pages';
import { cn } from '@/lib/utils';

interface AdminDashboardOverviewProps {
  onNavigate: (tabId: string) => void;
  visibleItems: AdminPageDef[];
  username?: string | null;
}

const PAGE_DESCRIPTIONS: Record<string, string> = {
  'users': 'จัดการสมาชิก กำหนดสิทธิ์ และควบคุมสถานะการแบน',
  'banned-roles': 'ตั้งค่าและควบคุมบทบาทยศ Discord ที่ห้ามใช้งาน',
  'banned-words': 'จัดการคำต้องห้าม คัดกรองความปลอดภัยของข้อความ',
  'tag-warn': 'ตรวจสอบและจัดการประวัติการแท็กเตือนสมาชิก',
  'contracts': 'สัญญาเช่าและข้อตกลงการให้บริการของคาเฟ่',
  'healing-messages': 'ตรวจสอบและอนุมัติข้อความบนกระดานให้กำลังใจ',
  'trading-history': 'ประวัติการซื้อขาย แลกเปลี่ยนไอเทม และเหรียญรางวัล',
  'role-transfer': 'โอนย้ายสิทธิ์ยศบทบาทของสมาชิก',
  'bulk-role-manage': 'จัดการกลุ่มยศของสมาชิกจำนวนมากพร้อมกัน',
  'reports': 'รายงานความประพฤติและคำขอปลดแบนประวัติเตือน',
  'categories': 'จัดการหมวดหมู่ของระบบและข้อมูลต่างๆ',
  'banners': 'อัปโหลดและอัปเดตภาพแบนเนอร์โฆษณาในคาเฟ่',
  'roles': 'ตั้งค่ายศเชื่อมต่อและประสานงานกับ Discord',
  'checkin-rewards': 'ตั้งค่าไอเทมและแต้มรางวัลสำหรับการเช็กอินประจำวัน',
  'campaigns': 'โปรโมชัน แคมเปญโฆษณา และสิทธิพิเศษของร้าน',
  'product-catalog': 'จัดการสินค้าและไอเทมในคลังสินค้าคาเฟ่',
  'discord-servers': 'จัดการ ตรวจสอบ และอนุมัติเซิร์ฟเวอร์พาร์ทเนอร์',
  'redeem-codes': 'สร้างโค้ดของรางวัลสำหรับสมาชิกนำไปแลกรับของ',
  'non-transferable-roles': 'กำหนดบทบาทยศ Discord ที่ห้ามไม่ให้โอนย้าย',
  'roles-to-delete': 'ยศ Discord ที่จะถูกนำออกโดยอัตโนมัติเมื่อทำการย้าย',
  'permissions': 'ควบคุมสิทธิ์การเข้าถึงหน้าต่างต่าง ๆ ของทีมงาน',
};

const GROUP_LABELS: Record<string, string> = {
  moderation: 'การดูแลความสงบเรียบร้อย (Moderation)',
  content: 'การจัดการเนื้อหาและกิจกรรม (Content)',
  system: 'การตั้งค่าและระบบหลังบ้าน (System)',
};

export function AdminDashboardOverview({ onNavigate, visibleItems, username }: AdminDashboardOverviewProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeReports: 0,
    pendingWarnings: 0,
    pendingServers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
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

      setStats({
        totalUsers: usersCount || 0,
        activeReports: reportsCount || 0,
        pendingWarnings: warningsCount || 0,
        pendingServers: serversCount || 0,
      });
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
    fetchStats();
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const desc = PAGE_DESCRIPTIONS[item.id] || 'ระบบบริการส่วนข้อมูลร้านกาแฟ';
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className="group text-left border border-border/50 rounded-2xl bg-card/60 p-4 hover:bg-card hover:-translate-y-1 hover:shadow-md hover:border-primary/20 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-primary/20 flex flex-col justify-between h-32"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {item.label}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {desc}
                        </p>
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 mt-2 bg-muted/65 group-hover:bg-primary/10 group-hover:text-primary rounded-md px-1.5 py-0.5 w-max transition-colors">
                        {item.id}
                      </span>
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
