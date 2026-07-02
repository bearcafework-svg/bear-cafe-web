import { useCallback, useEffect, useState } from "react";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { th } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const MOCK_LATE_CHECKOUT_HOUR = 20;

type WorkSessionRow = {
  id: string;
  user_id: string;
  nickname: string;
  position: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  note: string | null;
  // joined from profiles
  username: string;
  discord_id: string;
  discord_username: string | null;
  avatar_url: string | null;
};

function durationLabel(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return "กำลังทำงาน";
  const dur = intervalToDuration({
    start: new Date(checkIn),
    end: new Date(checkOut),
  });
  return formatDuration(dur, { locale: th, format: ["hours", "minutes"] }) || "< 1 นาที";
}

function isLate(checkOut: string | null): boolean {
  if (!checkOut) return false;
  return new Date(checkOut).getHours() >= MOCK_LATE_CHECKOUT_HOUR;
}

export default function ForStaffReportPage() {
  const [sessions, setSessions] = useState<WorkSessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Step 1: fetch work sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from("work_sessions")
        .select("id, user_id, nickname, position, check_in_time, check_out_time, status, note")
        .order("check_in_time", { ascending: false })
        .limit(200);

      if (sessionError) throw sessionError;
      if (!sessionData?.length) { setSessions([]); return; }

      // Step 2: fetch profiles for those user_ids
      const userIds = [...new Set(sessionData.map((s) => s.user_id))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, discord_id, discord_username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profileData ?? []).map((p) => [p.id, p])
      );

      const rows: WorkSessionRow[] = sessionData.map((row) => {
        const p = profileMap.get(row.user_id);
        return {
          ...row,
          username: p?.username ?? row.nickname,
          discord_id: p?.discord_id ?? "",
          discord_username: p?.discord_username ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });

      setSessions(rows);
    } catch (err) {
      console.error("Failed to fetch work sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = sessions.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      s.username.toLowerCase().includes(q) ||
      s.discord_id.includes(q) ||
      (s.discord_username ?? "").toLowerCase().includes(q) ||
      s.nickname.toLowerCase().includes(q);

    const matchDate =
      !dateFilter ||
      format(new Date(s.check_in_time), "yyyy-MM-dd") === dateFilter;

    return matchSearch && matchDate;
  });

  const activeCount = filtered.filter((s) => !s.check_out_time).length;
  const lateCount = filtered.filter((s) => isLate(s.check_out_time)).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fdf9] via-[#fef7fb] to-[#fff] px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        {/* ── Summary chips ── */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="rounded-full" size="sm">
            <Link to="/forstaff">
              <ArrowLeft className="mr-1 h-4 w-4" />
              กลับหน้าสแกน
            </Link>
          </Button>
          <Badge className="bg-emerald-100 text-emerald-700 rounded-full px-3 py-1">
            กำลังทำงาน: {activeCount} คน
          </Badge>
          {lateCount > 0 && (
            <Badge className="bg-orange-100 text-orange-700 rounded-full px-3 py-1">
              <AlertTriangle className="mr-1 h-3 w-3" />
              เกินเวลา: {lateCount} รายการ
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto rounded-full"
            onClick={fetchSessions}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
        </div>

        {/* ── Main card ── */}
        <Card className="rounded-2xl border-[#dbeedd] shadow-lg shadow-[#f4dde7]/50">
          <CardHeader className="space-y-4">
            <CardTitle className="text-[#45684a]">รายงานเช็กอิน / เช็คเอาท์พนักงาน</CardTitle>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, Discord ID, username..."
                  className="rounded-xl border-[#cce7d2] pl-9"
                />
              </div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-xl border-[#e7cad6]"
              />
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                กำลังโหลดข้อมูล...
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e8edf0]">
                <Table>
                  <TableHeader className="bg-[#f7fafb]">
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>พนักงาน</TableHead>
                      <TableHead>Discord</TableHead>
                      <TableHead>ตำแหน่ง</TableHead>
                      <TableHead>เช็กอิน</TableHead>
                      <TableHead>เช็คเอาท์</TableHead>
                      <TableHead>
                        <Clock className="inline h-3.5 w-3.5 mr-1" />
                        ระยะเวลา
                      </TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-12 text-center text-muted-foreground"
                        >
                          ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((s) => {
                      const late = isLate(s.check_out_time);
                      return (
                        <TableRow key={s.id} className="bg-white hover:bg-[#fafffe]">
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={s.avatar_url ?? undefined} alt={s.username} />
                              <AvatarFallback className="text-xs bg-[#d4edda] text-[#4a6a4d]">
                                🐻
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{s.username}</p>
                            <p className="text-xs text-muted-foreground">{s.nickname}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.discord_username ? (
                              <span>@{s.discord_username}</span>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">
                                {s.discord_id || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{s.position}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(s.check_in_time), "dd/MM/yy HH:mm", { locale: th })}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {s.check_out_time
                              ? format(new Date(s.check_out_time), "dd/MM/yy HH:mm", { locale: th })
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {durationLabel(s.check_in_time, s.check_out_time)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {!s.check_out_time ? (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                  กำลังทำงาน
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 text-xs">
                                  เสร็จสิ้น
                                </Badge>
                              )}
                              {late && (
                                <Badge className="bg-orange-100 text-orange-700 text-xs">
                                  ⚠️ เกินเวลา
                                </Badge>
                              )}
                            </div>
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
    </main>
  );
}
