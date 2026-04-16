import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, MousePointerClick, TrendingUp, TrendingDown, Minus,
  RefreshCw, BarChart2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OwnedServer {
  id: string;
  name: string;
  icon_url: string | null;
  click_count: number | null;
}

interface DailyStat {
  stat_date: string;   // YYYY-MM-DD
  click_count: number;
}

interface ChartPoint {
  label: string;       // "จ 12 เม.ย."
  clicks: number;
  date: string;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-0.5">{label}</p>
      <p className="text-primary font-bold">
        {payload[0].value.toLocaleString()} คลิก
      </p>
    </div>
  );
}

// ─── Trend badge ─────────────────────────────────────────────────────────────
function TrendBadge({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) return null;
  const last = data[data.length - 1].clicks;
  const prev = data[data.length - 2].clicks;
  if (prev === 0 && last === 0) return null;

  const pct = prev === 0 ? 100 : Math.round(((last - prev) / prev) * 100);
  if (pct > 0) return (
    <Badge className="bg-emerald-100 text-emerald-700 gap-1 text-xs">
      <TrendingUp className="h-3 w-3" />+{pct}% vs เมื่อวาน
    </Badge>
  );
  if (pct < 0) return (
    <Badge className="bg-red-100 text-red-700 gap-1 text-xs">
      <TrendingDown className="h-3 w-3" />{pct}% vs เมื่อวาน
    </Badge>
  );
  return (
    <Badge className="bg-muted text-muted-foreground gap-1 text-xs">
      <Minus className="h-3 w-3" />เท่าเดิม
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ServerAnalyticsDashboard() {
  const { user } = useAuth();
  const [ownedServers, setOwnedServers] = useState<OwnedServer[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [totalWeek, setTotalWeek] = useState(0);

  // ── Build 7-day skeleton (fills missing days with 0) ─────────────────────
  const buildChartData = useCallback((raw: DailyStat[]): ChartPoint[] => {
    const map = new Map(raw.map((r) => [r.stat_date, r.click_count]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const key = format(d, 'yyyy-MM-dd');
      return {
        date: key,
        label: format(d, 'EEE d MMM', { locale: th }),
        clicks: map.get(key) ?? 0,
      };
    });
  }, []);

  // ── Fetch owned servers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingServers(true);
      try {
        const { data } = await (supabase
          .from('discord_servers' as any)
          .select('id, name, icon_url, click_count')
          .eq('owner_id', user.discord_id)
          .eq('status', 'approved')
          .order('name')) as any;
        const servers = (data || []) as OwnedServer[];
        setOwnedServers(servers);
        if (servers.length > 0) setSelectedId(servers[0].id);
      } finally {
        setLoadingServers(false);
      }
    })();
  }, [user]);

  // ── Fetch stats when server changes ──────────────────────────────────────
  const fetchStats = useCallback(async (serverId: string) => {
    if (!serverId) return;
    setLoadingStats(true);
    try {
      const since = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const { data } = await (supabase
        .from('server_click_stats' as any)
        .select('stat_date, click_count')
        .eq('server_id', serverId)
        .gte('stat_date', since)
        .order('stat_date', { ascending: true })) as any;

      const points = buildChartData((data || []) as DailyStat[]);
      setChartData(points);
      setTotalWeek(points.reduce((s, p) => s + p.clicks, 0));
    } finally {
      setLoadingStats(false);
    }
  }, [buildChartData]);

  useEffect(() => {
    if (selectedId) fetchStats(selectedId);
  }, [selectedId, fetchStats]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!user) return null;

  const selectedServer = ownedServers.find((s) => s.id === selectedId);

  if (loadingServers) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">กำลังโหลดเซิร์ฟเวอร์ของคุณ...</span>
      </div>
    );
  }

  if (ownedServers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        คุณยังไม่มีเซิร์ฟเวอร์ที่ได้รับการอนุมัติ
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Server selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <BarChart2 className="h-5 w-5 text-primary shrink-0" />
        <h2 className="font-bold text-base text-foreground">สถิติเซิร์ฟเวอร์ของฉัน</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-52 rounded-xl h-9 text-sm">
              <SelectValue placeholder="เลือกเซิร์ฟเวอร์..." />
            </SelectTrigger>
            <SelectContent>
              {ownedServers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    {s.icon_url
                      ? <img src={s.icon_url} alt="" className="w-5 h-5 rounded-md object-cover" />
                      : <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">{s.name[0]}</div>}
                    <span className="truncate max-w-[160px]">{s.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm" variant="ghost"
            className="rounded-full h-9 w-9 p-0"
            onClick={() => fetchStats(selectedId)}
            disabled={loadingStats}
            aria-label="รีเฟรช"
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">คลิก 7 วันล่าสุด</p>
            <p className="text-2xl font-black text-foreground">{totalWeek.toLocaleString()}</p>
            <div className="mt-1.5">
              <TrendBadge data={chartData} />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">คลิกรวมทั้งหมด</p>
            <p className="text-2xl font-black text-foreground">
              {(selectedServer?.click_count ?? 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">unique users</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">เฉลี่ยต่อวัน</p>
            <p className="text-2xl font-black text-foreground">
              {chartData.length ? (totalWeek / 7).toFixed(1) : '0'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5">คลิก / วัน</p>
          </CardContent>
        </Card>
      </div>

      {/* Line chart */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" />
            คลิกย้อนหลัง 7 วัน
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {loadingStats ? (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">กำลังโหลดสถิติ...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#clickGradient)"
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
