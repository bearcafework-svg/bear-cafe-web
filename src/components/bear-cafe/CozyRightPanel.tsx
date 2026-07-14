import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import strawberryIcon from '@/assets/strawberry-icon.png';
import { RewardPopup, type RewardPopupData } from '@/components/bear-cafe/RewardPopup';
import { formatNumber } from '@/lib/utils';

// ─── Profile Card ─────────────────────────────────────────────────────────────
function ProfileCard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-2xl p-4 text-center space-y-3 border border-latte/30 dark:border-coffee/25 bg-card/80 dark:bg-card/60 backdrop-blur-sm">
        <div className="w-12 h-12 rounded-full bg-honey/15 dark:bg-honey/10 flex items-center justify-center mx-auto text-2xl">
          🐻
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">ยังไม่ได้เข้าสู่ระบบ</p>
          <p className="text-xs mt-0.5 text-muted-foreground">เข้าสู่ระบบเพื่อใช้งานเต็มรูปแบบ</p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-2 rounded-xl text-xs font-bold bg-honey hover:bg-honey/90 text-accent-foreground transition-opacity"
        >
          เข้าสู่ระบบ ☕
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border border-latte/30 dark:border-coffee/25 bg-card/80 dark:bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-latte/50 dark:border-coffee/40 shadow-md shrink-0">
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-peach to-honey/70 flex items-center justify-center text-lg">🐻</div>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-tight truncate text-foreground">
            {user.discord_username ?? user.username}
          </p>
          {user.discord_username && user.discord_username !== user.username && (
            <p className="text-[11px] truncate mt-0.5 text-muted-foreground">
              {user.username}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Points Widget ────────────────────────────────────────────────────────────
function PointsWidget() {
  const { user, isAuthenticated } = useAuth();

  const [points, setPoints] = useState(0);
  const [maxCap, setMaxCap] = useState(500);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [redeemMsg, setRedeemMsg] = useState('');
  const [rewardPopupOpen, setRewardPopupOpen] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<RewardPopupData | null>(null);

  const fetchPoints = useCallback(async () => {
    if (!user?.discord_id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('user_points')
        .select('points, max_cap')
        .eq('discord_id', user.discord_id)
        .maybeSingle();
      if (data) {
        setPoints(data.points ?? 0);
        setMaxCap(data.max_cap ?? 500);
      }
    } catch {}
    setLoading(false);
  }, [user?.discord_id]);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  useEffect(() => {
    if (!user?.discord_id) return;
    const id = setInterval(() => fetchPoints(), 30_000);
    return () => clearInterval(id);
  }, [fetchPoints, user?.discord_id]);

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code || !user?.discord_id) return;
    setRedeemStatus('loading');
    setRedeemMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { userId: user.discord_id, code },
      });
      if (error) throw error;
      if (!data.ok) {
        const msgs: Record<string, string> = {
          code_used: 'โค้ดนี้ถูกใช้ไปแล้ว',
          invalid_code: 'ไม่พบโค้ดนี้',
          expired: 'โค้ดหมดอายุแล้ว',
          already_redeemed: 'คุณเคยใช้โค้ดนี้แล้ว',
          limit_reached: 'โค้ดถูกใช้ครบโควต้าแล้ว',
          disabled: 'โค้ดถูกปิดใช้งาน',
        };
        const errMsg = msgs[data.error] ?? 'โค้ดไม่ถูกต้อง';
        setRedeemStatus('error');
        setRedeemMsg(errMsg);
        setRewardPopup({ type: 'points', message: errMsg });
        setRewardPopupOpen(true);
        return;
      }

      if (data.granted?.roleGranted) {
        try {
          await supabase.functions.invoke('grant-discord-role', {
            body: { discordUserId: user.discord_id, discordRoleId: data.granted.roleGranted },
          });
        } catch { /* non-blocking */ }
      }

      let roleName: string | undefined;
      let roleEmoji: string | undefined;
      let roleColor: string | undefined;

      if (data.granted?.roleGranted) {
        try {
          const { data: roleInfo } = await supabase.functions.invoke('get-role-info', {
            body: { role_id: data.granted.roleGranted },
          });
          if (roleInfo && !roleInfo.error) {
            roleName = roleInfo.name;
            roleEmoji = roleInfo.icon || roleInfo.unicode_emoji || undefined;
            roleColor = roleInfo.color || undefined;
          }
        } catch { /* ignore */ }
        if (!roleName) roleName = `ยศพิเศษ (${data.granted.roleGranted.slice(-6)})`;
        if (!roleEmoji) roleEmoji = '🎭';
      }

      const raw = data.pointsNow ?? (typeof data.points === 'number' ? data.points : Number(data.points));
      if (Number.isFinite(raw)) setPoints(Math.min(raw, maxCap));

      const hasPoints = !!data.granted?.pointsAdded;
      const hasRole = !!data.granted?.roleGranted;
      const popupType: RewardPopupData['type'] = hasPoints && hasRole ? 'both' : hasRole ? 'role' : 'points';
      const rewardMessage = hasPoints && hasRole
        ? `ได้รับ +${formatNumber(data.granted.pointsAdded)} 🍓 และยศใหม่`
        : hasRole ? 'ได้รับยศใหม่แล้ว 🎭'
        : hasPoints ? `+${formatNumber(data.granted.pointsAdded)} 🍓` : 'รับรางวัลสำเร็จ';

      setRedeemStatus('success');
      setRedeemMsg(rewardMessage);
      setRewardPopup({
        type: popupType,
        pointsAdded: data.granted?.pointsAdded,
        roleName,
        roleEmoji,
        roleColor,
        message: rewardMessage,
      });
      setRewardPopupOpen(true);
      setRedeemCode('');
      fetchPoints();
    } catch {
      const errMsg = 'ระบบขัดข้อง ลองใหม่อีกครั้ง';
      setRedeemStatus('error');
      setRedeemMsg(errMsg);
      setRewardPopup({ type: 'points', message: errMsg });
      setRewardPopupOpen(true);
    }
  };

  if (!isAuthenticated || !user) return null;

  const pct = maxCap > 0 ? Math.min((points / maxCap) * 100, 100) : 0;

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-latte/30 dark:border-coffee/25 bg-card/80 dark:bg-card/60 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <img src={strawberryIcon} alt="" className="w-4 h-4 object-contain" />
            <span className="text-xs font-bold text-muted-foreground">แต้มสะสม</span>
          </div>
          {loading && <Sparkles className="w-3 h-3 animate-pulse text-honey" />}
        </div>

        {/* Points display */}
        <div className="px-4 pb-3 space-y-2.5">
          <div className="flex items-end gap-1.5">
            <span className="text-3xl font-bold leading-none text-foreground">
              {loading ? '—' : formatNumber(points)}
            </span>
            <span className="text-xs pb-0.5 text-muted-foreground/60">/ {formatNumber(maxCap)}</span>
            <span className="text-base pb-0.5 ml-0.5">🍓</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full overflow-hidden bg-honey/15 dark:bg-honey/10">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-honey to-peach"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-latte/30 dark:bg-coffee/25" />

        {/* Redeem code */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Gift className="w-3 h-3 text-honey" />
            <span className="text-[11px] font-semibold text-muted-foreground">กรอกโค้ดรับรางวัล</span>
          </div>

          <div className="flex gap-2">
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="โค้ดของคุณ..."
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl text-xs border border-latte/40 dark:border-coffee/30 bg-background/60 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-honey/60 dark:focus:border-honey/40 focus:ring-1 focus:ring-honey/30 transition-colors"
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleRedeem}
              disabled={redeemStatus === 'loading' || !redeemCode.trim()}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-honey hover:bg-honey/90 text-accent-foreground disabled:opacity-50 transition-opacity"
            >
              {redeemStatus === 'loading' ? '...' : 'ยืนยัน'}
            </motion.button>
          </div>

          <AnimatePresence>
            {redeemMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                {redeemStatus === 'success'
                  ? <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                  : <XCircle className="w-3 h-3 text-destructive shrink-0" />
                }
                <span className={`text-[11px] ${redeemStatus === 'success' ? 'text-success' : 'text-destructive'}`}>
                  {redeemMsg}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <RewardPopup
        open={rewardPopupOpen}
        onOpenChange={(open) => {
          setRewardPopupOpen(open);
          if (!open) {
            setRewardPopup(null);
            setRedeemStatus('idle');
            setRedeemMsg('');
          }
        }}
        reward={rewardPopup}
      />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CozyRightPanel() {
  return (
    <aside className="w-[264px] shrink-0 flex flex-col gap-4 h-[100dvh] overflow-y-auto py-5 px-3">
      <ProfileCard />
      <PointsWidget />
    </aside>
  );
}
