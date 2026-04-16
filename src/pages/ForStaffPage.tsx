import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  AlertTriangle,
  ChartNoAxesCombined,
  CheckCircle2,
  Loader2,
  PencilLine,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPLOYEE_KEY = "forstaff_employee_discord_id";
const MOCK_LATE_CHECKOUT_HOUR = 20; // 20:00 = 8 PM

// ─── Types ────────────────────────────────────────────────────────────────────
type StaffProfile = {
  id: string;
  username: string;
  discord_id: string;
  discord_username: string | null;
  avatar_url: string | null;
};

type ActiveWorkSession = {
  id: string;
  check_in_time: string;
  nickname: string;
  position: string;
};

type ScanResult = {
  action: "check-in" | "check-out";
  profile: StaffProfile;
  session: ActiveWorkSession;
  lateWarning: boolean;
};

// ─── Bear Paw SVG ─────────────────────────────────────────────────────────────
function BearPawIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main pad */}
      <ellipse cx="50" cy="62" rx="28" ry="24" />
      {/* Toe pads */}
      <circle cx="26" cy="36" r="10" />
      <circle cx="42" cy="28" r="10" />
      <circle cx="58" cy="28" r="10" />
      <circle cx="74" cy="36" r="10" />
    </svg>
  );
}

// ─── Scan animation rings ─────────────────────────────────────────────────────
function ScanRings({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-current opacity-0"
          style={{
            width: `${60 + i * 30}%`,
            height: `${60 + i * 30}%`,
            animation: `ping 1.4s ease-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForStaffPage() {
  const [discordId, setDiscordId] = useState("");
  const [savedDiscordId, setSavedDiscordId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveWorkSession | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPressed, setScanPressed] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load saved ID on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(EMPLOYEE_KEY);
    if (stored) {
      setSavedDiscordId(stored);
      setDiscordId(stored);
    }
  }, []);

  // ── Fetch profile + active session when savedDiscordId changes ──────────────
  const fetchProfileAndSession = useCallback(async (id: string) => {
    setIsLoadingProfile(true);
    setProfileError(null);
    setProfile(null);
    setActiveSession(null);

    try {
      // Look up profile by discord_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, discord_id, discord_username, avatar_url")
        .eq("discord_id", id.trim())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        setProfileError("ไม่พบพนักงานที่มี Discord ID นี้ในระบบ");
        setIsLoadingProfile(false);
        return;
      }

      setProfile(profileData);

      // Check for an open work session (no check_out_time)
      const { data: sessionData } = await supabase
        .from("work_sessions")
        .select("id, check_in_time, nickname, position")
        .eq("user_id", profileData.id)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionData) setActiveSession(sessionData);
    } catch (err) {
      setProfileError("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่");
      console.error(err);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (savedDiscordId) fetchProfileAndSession(savedDiscordId);
  }, [savedDiscordId, fetchProfileAndSession]);

  // ── Save ID ─────────────────────────────────────────────────────────────────
  const saveDiscordId = () => {
    const trimmed = discordId.trim();
    if (!trimmed) return;
    localStorage.setItem(EMPLOYEE_KEY, trimmed);
    setSavedDiscordId(trimmed);
  };

  const clearDiscordId = () => {
    localStorage.removeItem(EMPLOYEE_KEY);
    setSavedDiscordId(null);
    setDiscordId("");
    setProfile(null);
    setActiveSession(null);
    setProfileError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Soft beep ───────────────────────────────────────────────────────────────
  const playSoftBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.value = 0.025;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // audio optional
    }
  };

  // ── Scan / Check-in / Check-out ─────────────────────────────────────────────
  const startScan = async () => {
    if (isScanning || !profile) return;

    setScanPressed(true);
    setIsScanning(true);
    playSoftBeep();

    // Simulate fingerprint scan delay
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const now = new Date();
      const isCheckOut = Boolean(activeSession);
      const lateWarning = isCheckOut && now.getHours() >= MOCK_LATE_CHECKOUT_HOUR;

      if (isCheckOut && activeSession) {
        // Check-out: update existing session
        await supabase
          .from("work_sessions")
          .update({
            check_out_time: now.toISOString(),
            status: "completed",
            note: lateWarning ? "เช็คเอาท์เกินเวลา" : null,
          })
          .eq("id", activeSession.id);

        setScanResult({
          action: "check-out",
          profile,
          session: activeSession,
          lateWarning,
        });
        setActiveSession(null);
      } else {
        // Check-in: create new session
        const { data: newSession, error } = await supabase
          .from("work_sessions")
          .insert({
            user_id: profile.id,
            nickname: profile.discord_username ?? profile.username,
            position: "Staff",
            check_in_time: now.toISOString(),
            status: "active",
          })
          .select("id, check_in_time, nickname, position")
          .single();

        if (error) throw error;

        setScanResult({
          action: "check-in",
          profile,
          session: newSession,
          lateWarning: false,
        });
        setActiveSession(newSession);
      }

      setShowResult(true);
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
      setScanPressed(false);
    }
  };

  const isCheckedIn = Boolean(activeSession);
  const canScan = Boolean(profile) && !isLoadingProfile && !isScanning;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e8f7ea] via-[#fdf8fb] to-[#fff7fb] px-4 py-8">
      <style>{`
        @keyframes ping {
          0% { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pawPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {/* ── Header Card ── */}
        <Card className="rounded-2xl border-[#d3ebd5] bg-white/90 shadow-lg shadow-[#f4dceb]/50">
          <CardHeader className="relative space-y-2">
            <div className="absolute right-5 top-5 flex items-center gap-2">
              {savedDiscordId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={clearDiscordId}
                >
                  <PencilLine className="mr-1 h-3 w-3" />
                  เปลี่ยน ID
                </Button>
              )}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="rounded-full text-[#5f8462]"
              >
                <Link to="/forstaff/report" aria-label="รายงาน">
                  <ChartNoAxesCombined className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <BearPawIcon className="h-9 w-9 text-[#8bc89c]" />
              <div>
                <CardTitle className="text-2xl text-[#4a6a4d]">Bear Paw Check-in</CardTitle>
                <CardDescription className="text-sm">
                  ระบบเช็คอิน / เช็คเอาท์พนักงาน — สแกนอุ้งเท้าหมี
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* ── ID Entry ── */}
            {!savedDiscordId ? (
              <div className="space-y-2 rounded-xl border border-dashed border-[#f7cddd] bg-[#fffafb] p-4">
                <Label htmlFor="discord-id" className="text-[#5a3a4a]">
                  Discord ID (ตัวเลข)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    id="discord-id"
                    value={discordId}
                    onChange={(e) => setDiscordId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDiscordId()}
                    placeholder="เช่น 123456789012345678"
                    className="rounded-xl border-[#f4d4df] font-mono"
                  />
                  <Button
                    onClick={saveDiscordId}
                    disabled={!discordId.trim()}
                    className="rounded-xl bg-[#8bc89c] text-[#14331b] hover:bg-[#79b98c]"
                  >
                    บันทึก
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ระบบจะจำ ID นี้ไว้ในอุปกรณ์ของคุณ ไม่ต้องกรอกซ้ำ
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#d6ead8] bg-[#f3fbf5] px-4 py-3 text-sm text-[#35543a]">
                ระบบจำ Discord ID ของคุณแล้ว:{" "}
                <strong className="font-mono">{savedDiscordId}</strong>
              </div>
            )}

            {/* ── Profile Loading ── */}
            {isLoadingProfile && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังโหลดข้อมูลพนักงาน...
              </div>
            )}

            {/* ── Profile Error ── */}
            {profileError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="h-4 w-4 shrink-0" />
                {profileError}
              </div>
            )}

            {/* ── Profile Card ── */}
            {profile && !isLoadingProfile && (
              <div className="flex items-center gap-4 rounded-xl border border-[#e0f1e2] bg-[#f7fff8] p-4">
                <Avatar className="h-14 w-14 ring-2 ring-[#8bc89c]/40">
                  <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.username} />
                  <AvatarFallback className="bg-[#d4edda] text-[#4a6a4d] text-lg">
                    🐻
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#324f38] truncate">{profile.username}</p>
                  {profile.discord_username && (
                    <p className="text-sm text-muted-foreground truncate">
                      @{profile.discord_username}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {profile.discord_id}
                  </p>
                </div>
                <Badge
                  className={
                    isCheckedIn
                      ? "bg-[#ffe1a8] text-[#8a5b00] shrink-0"
                      : "bg-[#dff5e4] text-[#2f6f3f] shrink-0"
                  }
                >
                  {isCheckedIn ? "กำลังทำงาน" : "ยังไม่ได้เช็คอิน"}
                </Badge>
              </div>
            )}

            {/* ── Active session info ── */}
            {activeSession && (
              <div className="rounded-xl border border-[#ffe1a8] bg-[#fffbf0] px-4 py-3 text-sm text-[#7a5200]">
                เช็คอินเมื่อ:{" "}
                <strong>
                  {format(new Date(activeSession.check_in_time), "HH:mm น. (dd MMM yyyy)", {
                    locale: th,
                  })}
                </strong>
              </div>
            )}

            {/* ── Bear Paw Scan Button ── */}
            <button
              type="button"
              disabled={!canScan}
              onClick={startScan}
              className={[
                "relative flex h-44 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-200 select-none",
                isCheckedIn
                  ? "border-[#f4b8c8] bg-[#fff0f5] text-[#c0526e]"
                  : "border-[#a8d8b0] bg-[#f0faf2] text-[#3d7a4d]",
                scanPressed ? "scale-95" : "scale-100",
                !canScan ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-95 active:scale-95",
              ].join(" ")}
            >
              <ScanRings active={isScanning} />

              {isScanning ? (
                <>
                  <BearPawIcon
                    className="z-10 h-14 w-14 opacity-80"
                    style={{ animation: "pawPulse 0.7s ease-in-out infinite" } as React.CSSProperties}
                  />
                  <span className="z-10 text-sm font-semibold">กำลังสแกนอุ้งเท้า...</span>
                  <span className="z-10 text-xs opacity-70">โปรดรอสักครู่</span>
                </>
              ) : (
                <>
                  <BearPawIcon className="z-10 h-14 w-14" />
                  <span className="z-10 text-base font-semibold">
                    {!profile
                      ? "กรุณากรอก Discord ID ก่อน"
                      : isCheckedIn
                      ? "แตะอุ้งเท้าเพื่อเช็คเอาท์"
                      : "แตะอุ้งเท้าเพื่อเช็คอิน"}
                  </span>
                  <span className="z-10 text-xs opacity-60">
                    {profile ? "ระบบจะล็อกระหว่างสแกน ~1.5 วินาที" : ""}
                  </span>
                </>
              )}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ── Result Dialog ── */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="rounded-2xl border-[#ead0db] bg-[#fffdfd] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4f7258]">ผลการสแกนพนักงาน</DialogTitle>
          </DialogHeader>

          {scanResult && (
            <div className="space-y-4">
              {/* Profile row */}
              <div className="flex items-center gap-3 rounded-xl border border-[#e0f1e2] bg-[#f7fff8] p-3">
                <Avatar className="h-14 w-14 ring-2 ring-[#8bc89c]/40">
                  <AvatarImage
                    src={scanResult.profile.avatar_url ?? undefined}
                    alt={scanResult.profile.username}
                  />
                  <AvatarFallback className="bg-[#d4edda] text-[#4a6a4d] text-lg">🐻</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#324f38]">{scanResult.profile.username}</p>
                  {scanResult.profile.discord_username && (
                    <p className="text-sm text-muted-foreground">
                      @{scanResult.profile.discord_username}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono">
                    Discord ID: {scanResult.profile.discord_id}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                <p>
                  <span className="text-muted-foreground">ตำแหน่ง:</span>{" "}
                  <strong>{scanResult.session.position}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">สถานะ:</span>{" "}
                  <strong>
                    {scanResult.action === "check-in" ? "✅ Check-in" : "🚪 Check-out"}
                  </strong>
                </p>
                <p>
                  <span className="text-muted-foreground">เวลา:</span>{" "}
                  <strong>
                    {format(
                      new Date(
                        scanResult.action === "check-in"
                          ? scanResult.session.check_in_time
                          : new Date().toISOString()
                      ),
                      "dd MMM yyyy, HH:mm:ss",
                      { locale: th }
                    )}
                  </strong>
                </p>
                {scanResult.action === "check-in" && (
                  <p>
                    <span className="text-muted-foreground">Session ID:</span>{" "}
                    <span className="font-mono text-xs">{scanResult.session.id}</span>
                  </p>
                )}
              </div>

              {/* Status message */}
              <div
                className={[
                  "flex items-start gap-2 rounded-xl p-3 text-sm font-medium",
                  scanResult.lateWarning
                    ? "bg-orange-100 text-orange-700"
                    : scanResult.action === "check-in"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#fce8f2] text-[#8a4f69]",
                ].join(" ")}
              >
                {scanResult.lateWarning ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : scanResult.action === "check-in" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  {scanResult.action === "check-in"
                    ? "เช็คอินเรียบร้อยแล้ว ✨ ขอให้ทำงานสนุกนะ!"
                    : "เลิกงานแล้ว พักผ่อนเยอะ ๆ นะ 🌙"}
                  {scanResult.lateWarning && (
                    <p className="mt-1 font-semibold">⚠️ คุณเช็คเอาท์เกินเวลาที่กำหนด</p>
                  )}
                </div>
              </div>

              <Button
                className="w-full rounded-xl bg-[#8bc89c] text-[#14331b] hover:bg-[#79b98c]"
                onClick={() => setShowResult(false)}
              >
                ปิด
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
