import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, Eye, MousePointerClick, Heart, ExternalLink, RefreshCw,
  Sparkles, Flame, TrendingUp, Search, ShieldCheck, UserCheck, UserX,
  Layers, BarChart2,
} from 'lucide-react';

interface DiscoveryAnalyticsRow {
  source: string;
  total_impressions: number;
  total_views: number;
  total_clicks: number;
  total_saves: number;
  authenticated_clicks: number;
  guest_clicks: number;
  ctr: number;
  view_rate: number;
  save_rate: number;
  join_rate: number;
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  recommendation: { label: '🎯 แนะนำสำหรับคุณ', icon: Sparkles, color: 'text-amber-500 bg-amber-500/10' },
  trending: { label: '🔥 กำลังมาแรง', icon: Flame, color: 'text-orange-500 bg-orange-500/10' },
  rising: { label: '🚀 โตเร็ว', icon: TrendingUp, color: 'text-purple-500 bg-purple-500/10' },
  new: { label: '🆕 ใหม่', icon: Sparkles, color: 'text-emerald-500 bg-emerald-500/10' },
  search: { label: '🔍 ค้นหา', icon: Search, color: 'text-blue-500 bg-blue-500/10' },
  saved: { label: '❤️ บันทึกไว้', icon: Heart, color: 'text-rose-500 bg-rose-500/10' },
  unspecified: { label: '🌐 ไม่ระบุ (General)', icon: Layers, color: 'text-muted-foreground bg-muted' },
};

export function DiscoveryAnalyticsSection() {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiscoveryAnalyticsRow[]>([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data: rows, error } = await (supabase.rpc('get_discovery_analytics_summary' as any, {
        p_days: days,
      })) as any;

      if (error) throw error;
      setData((rows || []) as DiscoveryAnalyticsRow[]);
    } catch (err) {
      console.warn('Failed to fetch discovery analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  // Aggregate totals
  const totalImps = data.reduce((acc, r) => acc + Number(r.total_impressions || 0), 0);
  const totalViews = data.reduce((acc, r) => acc + Number(r.total_views || 0), 0);
  const totalClicks = data.reduce((acc, r) => acc + Number(r.total_clicks || 0), 0);
  const totalSaves = data.reduce((acc, r) => acc + Number(r.total_saves || 0), 0);
  const totalAuthClicks = data.reduce((acc, r) => acc + Number(r.authenticated_clicks || 0), 0);
  const totalGuestClicks = data.reduce((acc, r) => acc + Number(r.guest_clicks || 0), 0);

  const recRow = data.find((r) => r.source === 'recommendation');

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <span>สถิติและการค้นพบ (Discovery & Recommendation Baseline)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            วัดพฤติกรรมจริงจาก Production สำหรับช่วงเวลาที่เลือก
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={days.toString()} onValueChange={(val) => setDays(Number(val))}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 วันล่าสุด</SelectItem>
              <SelectItem value="14">14 วันล่าสุด</SelectItem>
              <SelectItem value="30">30 วันล่าสุด</SelectItem>
              <SelectItem value="60">60 วันล่าสุด</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchAnalytics}
            disabled={loading}
            className="rounded-xl h-9 text-xs gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">การแสดงผล (Impressions)</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalImps.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">เปิดดูรายละเอียด (Views)</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalViews.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">คลิกเข้า Discord</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalClicks.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">บันทึกเซิร์ฟเวอร์ (Saves)</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{totalSaves.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendation Spotlight & Funnel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>🎯 แนะนำสำหรับคุณ (Recommendation)</span>
            </h4>
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px]">
              Plan 2 Engine
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background/80 p-2.5 rounded-xl border border-border">
              <span className="text-muted-foreground">CTR แนะนำ</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {recRow ? `${(Number(recRow.ctr || 0) * 100).toFixed(1)}%` : '0.0%'}
              </p>
            </div>
            <div className="bg-background/80 p-2.5 rounded-xl border border-border">
              <span className="text-muted-foreground">Save Rate</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {recRow ? `${(Number(recRow.save_rate || 0) * 100).toFixed(1)}%` : '0.0%'}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            วัดผล Conversion เฉพาะผู้ใช้ที่คลิกหรือบันทึกผ่านแถบแนะนำ
          </p>
        </Card>

        {/* User Engagement Split */}
        <Card className="rounded-2xl border border-border shadow-sm p-4 space-y-3 md:col-span-2">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>สัดส่วนผู้ใช้งาน (User & Guest Click Breakdown)</span>
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground">ล็อกอิน (Authenticated)</span>
                <p className="text-base font-bold text-foreground">{totalAuthClicks.toLocaleString()} คลิก</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border">
              <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4" />
              </div>
              <div>
                <span className="text-muted-foreground">ผู้มาเยือน (Guest)</span>
                <p className="text-base font-bold text-foreground">{totalGuestClicks.toLocaleString()} คลิก</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Guest ใช้งาน General Discovery ปลอดภัย 100% โดยไม่มีการดึงข้อมูลโปรไฟล์ข้ามเครื่อง
          </p>
        </Card>
      </div>

      {/* Breakdown Table by Source */}
      <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
        <CardHeader className="px-5 py-4 border-b border-border bg-muted/10">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>เปรียบเทียบประสิทธิภาพแยกตามแหล่งที่มา (Source Attribution)</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {days} วันล่าสุด
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            เปรียบเทียบ Impressions, Clicks, Saves, CTR และ Discord Click Rate ของแต่ละหมวดหมู่
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังโหลดข้อมูลสถิติ...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              ยังไม่มีข้อมูลการใช้งานในรอบ {days} วันที่เลือก
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[180px]">แหล่งที่มา (Source)</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Clicks เข้าดิส</TableHead>
                    <TableHead className="text-right">Saves</TableHead>
                    <TableHead className="text-right">CTR (%)</TableHead>
                    <TableHead className="text-right">Save Rate (%)</TableHead>
                    <TableHead className="text-right">Join Rate (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => {
                    const info = SOURCE_LABELS[row.source] || SOURCE_LABELS.unspecified;
                    const Icon = info.icon;
                    return (
                      <TableRow key={row.source} className="text-xs">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className={`p-1 rounded-md ${info.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span>{info.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{Number(row.total_impressions || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(row.total_views || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {Number(row.total_clicks || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-rose-500 font-medium">
                          {Number(row.total_saves || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(Number(row.ctr || 0) * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {(Number(row.save_rate || 0) * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {(Number(row.join_rate || 0) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
