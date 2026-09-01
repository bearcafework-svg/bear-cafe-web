import React, { useState, useEffect } from 'react';
import { CozyAppShell } from '@/components/bear-cafe/CozyAppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Crown, Calendar, Infinity as InfinityIcon, Sparkles, Gamepad2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LeaderboardItem {
  discord_id: string;
  total_wins: number;
  total_points: number;
  last_win: string;
}

export default function LeaderboardPage() {
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState<'30d' | 'all'>('30d');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const daysParam = timeFilter === '30d' ? 30 : null;
      const gameParam = gameFilter !== 'all' ? Number(gameFilter) : null;

      // 1. Try calling RPC get_minigame_leaderboard
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_minigame_leaderboard', {
        days_limit: daysParam,
        filter_game_id: gameParam
      });

      if (!rpcErr && rpcData) {
        const sorted: LeaderboardItem[] = rpcData.map((row: any) => ({
          discord_id: row.discord_id,
          total_wins: Number(row.wins || 0),
          total_points: Number(row.points || 0),
          last_win: row.last_win || new Date().toISOString()
        }));
        setLeaderboard(sorted);
        return;
      }

      // 2. Fallback query using minigame_leaderboard_summary view
      const { data: summaryData, error: summaryErr } = await (supabase as any)
        .from('minigame_leaderboard_summary')
        .select('discord_id, wins, points, last_win')
        .limit(100);

      if (!summaryErr && summaryData && summaryData.length > 0) {
        const sorted: LeaderboardItem[] = summaryData.map((row: any) => ({
          discord_id: row.discord_id,
          total_wins: Number(row.wins || 0),
          total_points: Number(row.points || 0),
          last_win: row.last_win || new Date().toISOString()
        }));
        setLeaderboard(sorted);
        return;
      }

      // 3. Last-resort fallback with strict limit (max 500 rows)
      let query = supabase
        .from('minigame_wins')
        .select('discord_id, game_id, points_earned, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (timeFilter === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      if (gameFilter !== 'all') {
        query = query.eq('game_id', Number(gameFilter));
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group statistics by user discord_id
      const statsMap = new Map<string, LeaderboardItem>();

      for (const row of (data || []) as any[]) {
        const uid = row.discord_id;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            discord_id: uid,
            total_wins: 0,
            total_points: 0,
            last_win: row.created_at
          });
        }

        const stat = statsMap.get(uid)!;
        stat.total_wins += 1;
        stat.total_points += Number(row.points_earned || 0);

        if (new Date(row.created_at) > new Date(stat.last_win)) {
          stat.last_win = row.created_at;
        }
      }

      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
        return b.total_points - a.total_points;
      });

      setLeaderboard(sorted);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาดในการดึงข้อมูลจัดอันดับ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFilter, gameFilter]);

  const top1 = leaderboard[0] || null;
  const top2 = leaderboard[1] || null;
  const top3 = leaderboard[2] || null;

  return (
    <CozyAppShell>
      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
            <Sparkles className="w-4 h-4" /> ตารางจัดอันดับมินิเกมคาเฟ่หมี (Leaderboards)
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-rose-400 to-purple-500 bg-clip-text text-transparent">
            Hall of Fame — ผู้ชนะมินิเกมสูงสุด
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            สรุปอันดับผู้เล่นที่ชนะมินิเกมและได้รับแต้มสะสมมากที่สุดประจำเซิร์ฟเวอร์
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-3 rounded-2xl border border-border">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
            <Button
              size="sm"
              variant={timeFilter === '30d' ? 'default' : 'ghost'}
              className="rounded-lg text-xs font-semibold"
              onClick={() => setTimeFilter('30d')}
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> 30 วันล่าสุด (30d)
            </Button>
            <Button
              size="sm"
              variant={timeFilter === 'all' ? 'default' : 'ghost'}
              className="rounded-lg text-xs font-semibold"
              onClick={() => setTimeFilter('all')}
            >
              <InfinityIcon className="w-3.5 h-3.5 mr-1.5" /> จัดอันดับทั้งหมด (All-Time)
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={gameFilter} onValueChange={(val) => setGameFilter(val)}>
              <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
                <SelectValue placeholder="เลือกมินิเกม" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">มินิเกมทั้งหมดรวมกัน</SelectItem>
                <SelectItem value="1">1. เติมคำศัพท์ไทย</SelectItem>
                <SelectItem value="2">2. เติมคำศัพท์ภาษาอังกฤษ</SelectItem>
                <SelectItem value="3">3. สุ่มโจทย์คณิตฯ</SelectItem>
                <SelectItem value="4">4. ทายคำจากคำใบ้</SelectItem>
                <SelectItem value="5">5. เรียงคำศัพท์ไทย</SelectItem>
                <SelectItem value="6">6. เรียงคำศัพท์อังกฤษ</SelectItem>
                <SelectItem value="7">7. พิมพ์คำต่อไปนี้ (ไทย)</SelectItem>
                <SelectItem value="8">8. พิมพ์คำต่อไปนี้ (อังกฤษ)</SelectItem>
                <SelectItem value="9">9. ทายคำแปลภาษาอังกฤษ</SelectItem>
                <SelectItem value="10">10. ทายคำแปลภาษาไทย</SelectItem>
                <SelectItem value="11">11. เกมต่อคำ</SelectItem>
                <SelectItem value="12">12. ข้อไหนไม่เข้าพวก</SelectItem>
                <SelectItem value="13">13. จริงหรือเท็จ</SelectItem>
              </SelectContent>
            </Select>

            <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={fetchLeaderboard}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Podium Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
          
          {/* Rank 2 */}
          <Card className="order-2 md:order-1 border-slate-300 dark:border-slate-700 bg-card/80 backdrop-blur-md hover:scale-[1.02] transition-transform">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                <Medal className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="w-fit mx-auto border-slate-400 text-slate-500 font-bold">
                อันดับ 2 (Silver)
              </Badge>
              <CardTitle className="text-base font-bold font-mono mt-2">{top2 ? top2.discord_id : '-'}</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm font-semibold text-muted-foreground">
              {top2 ? `ชนะ ${top2.total_wins} ครั้ง (${top2.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
            </CardContent>
          </Card>

          {/* Rank 1 */}
          <Card className="order-1 md:order-2 border-amber-400 dark:border-amber-500 bg-amber-500/5 backdrop-blur-md shadow-xl shadow-amber-500/10 hover:scale-[1.04] transition-transform">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-2 shadow-lg shadow-amber-500/30">
                <Crown className="w-8 h-8" />
              </div>
              <Badge className="w-fit mx-auto bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-extrabold px-3 py-1">
                🏆 อันดับ 1 (Gold Champion)
              </Badge>
              <CardTitle className="text-lg font-extrabold font-mono mt-2 text-amber-500">{top1 ? top1.discord_id : '-'}</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-base font-bold text-amber-600 dark:text-amber-400">
              {top1 ? `ชนะ ${top1.total_wins} ครั้ง (${top1.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
            </CardContent>
          </Card>

          {/* Rank 3 */}
          <Card className="order-3 border-amber-800/40 bg-card/80 backdrop-blur-md hover:scale-[1.02] transition-transform">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-900/20 flex items-center justify-center text-amber-700 mb-2">
                <Award className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="w-fit mx-auto border-amber-700 text-amber-700 font-bold">
                อันดับ 3 (Bronze)
              </Badge>
              <CardTitle className="text-base font-bold font-mono mt-2">{top3 ? top3.discord_id : '-'}</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm font-semibold text-muted-foreground">
              {top3 ? `ชนะ ${top3.total_wins} ครั้ง (${top3.total_points} แต้ม)` : 'ไม่มีข้อมูล'}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Leaderboard Table */}
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              ตารางสรุปอันดับผู้เล่นทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">อันดับ</TableHead>
                  <TableHead>User Discord ID</TableHead>
                  <TableHead>จำนวนครั้งที่ชนะ</TableHead>
                  <TableHead>แต้มสะสมรวม</TableHead>
                  <TableHead className="text-right">ชนะล่าสุด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      ไม่พบข้อมูลผู้ชนะในหมวดหมู่นี้
                    </TableCell>
                  </TableRow>
                ) : (
                  leaderboard.map((item, index) => (
                    <TableRow key={item.discord_id}>
                      <TableCell className="font-extrabold text-sm">
                        {index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{item.discord_id}</TableCell>
                      <TableCell className="font-bold text-sky-500">{item.total_wins} ครั้ง</TableCell>
                      <TableCell className="font-bold text-amber-500">{item.total_points} แต้ม</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(item.last_win).toLocaleString('th-TH')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </CozyAppShell>
  );
}
