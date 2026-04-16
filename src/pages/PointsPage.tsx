import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { HomeSidebar } from '@/components/bear-cafe/HomeSidebar';
import { Footer } from '@/components/bear-cafe/Footer';
import { StrawberryJar } from '@/components/bear-cafe/StrawberryJar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, Gift, Menu, Sparkles, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { RewardPopup, type RewardPopupData } from '@/components/bear-cafe/RewardPopup';

// Hook to fetch Discord member count
function useMemberCount() {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('discord-member-count');
        if (!error && data) setMemberCount(data.member_count);
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return memberCount;
}

// Points are now fetched directly from Supabase user_points table
const DEFAULT_ERROR_MESSAGE = 'ระบบไม่สามารถดึงข้อมูลแต้มได้ในขณะนี้';

type PointsStatus = 'idle' | 'loading' | 'success' | 'error';
type RedeemStatus = 'idle' | 'loading' | 'success' | 'error';

type RedeemReward = RewardPopupData;

type RedeemResponse = {
  ok?: boolean;
  userId?: string;
  code?: string;
   granted?: {
     pointsAdded?: number;
     roleGranted?: string;
   };
   pointsNow?: number;
  points?: number | string;
  error?: string;
};

export default function PointsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const memberCount = useMemberCount();
  const [points, setPoints] = useState(0);
  const [maxCap, setMaxCap] = useState(500);
  const [status, setStatus] = useState<PointsStatus>('idle');
  const [message, setMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<RedeemStatus>('idle');
  const [redeemMessage, setRedeemMessage] = useState('');
  const [rewardPopupOpen, setRewardPopupOpen] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<RedeemReward | null>(null);

  const fetchPoints = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (!user?.discord_id) {
      setPoints(0);
      setStatus('success');
      setMessage('ยังไม่พบข้อมูลผู้ใช้ในระบบ');
      return;
    }

    if (showLoading) {
      setStatus('loading');
      setMessage('');
    }

    try {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('discord_id', user.discord_id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setPoints(0);
        setMaxCap(500);
        if (showLoading) {
          setStatus('success');
          setMessage('');
        }
        return;
      }

      const nextCap = data.max_cap ?? 500;
      if (nextCap > 0) setMaxCap(nextCap);
      setPoints(data.points ?? 0);
      if (showLoading) {
        setStatus('success');
        setMessage('');
      }
    } catch {
      setStatus('error');
      setMessage(DEFAULT_ERROR_MESSAGE);
    }
  }, [user?.discord_id]);

  const redeemErrorMessages = useMemo(() => ({
    code_used: 'โค้ดนี้ถูกใช้ไปแล้ว',
     invalid_code: 'ไม่พบโค้ดนี้',
     expired: 'โค้ดหมดอายุแล้ว',
     not_started: 'โค้ดยังไม่ถึงเวลาใช้งาน',
     limit_reached: 'โค้ดถูกใช้ครบโควต้าแล้ว',
     already_redeemed: 'คุณเคยใช้โค้ดนี้ไปแล้ว',
     disabled: 'โค้ดนี้ถูกปิดใช้งาน',
     misconfigured_code: 'โค้ดไม่ถูกต้อง กรุณาติดต่อแอดมิน',
    missing_code: 'กรุณากรอกโค้ด',
  }), []);

  const buildRewardMessage = (granted?: { pointsAdded?: number; roleGranted?: string }) => {
    if (!granted) {
      return 'รับรางวัลสำเร็จ';
    }

    const pointsText = granted.pointsAdded ? `ได้รับ +${granted.pointsAdded.toLocaleString()} 🍓` : '';
    const roleText = granted.roleGranted ? `ได้รับยศใหม่` : '';

    if (granted.pointsAdded && granted.roleGranted) {
      return [pointsText, roleText].filter(Boolean).join(' และ ');
    }

    if (granted.roleGranted) {
      return 'ได้รับยศใหม่แล้ว 🎭';
    }

    return pointsText || 'ได้รับสตอเบอรี่แล้ว 🍓';
  };

  const buildRewardType = (granted?: { pointsAdded?: number; roleGranted?: string }): RedeemReward['type'] => {
    if (granted?.pointsAdded && granted?.roleGranted) {
      return 'both';
    }
    if (granted?.roleGranted) {
      return 'role';
    }
    return 'points';
  };

  // Function to grant Discord role via edge function
  const grantDiscordRole = useCallback(async (roleId: string): Promise<boolean> => {
    if (!user?.discord_id) return false;
 
    try {
      const { data, error } = await supabase.functions.invoke('grant-discord-role', {
        body: {
          discordUserId: user.discord_id,
          discordRoleId: roleId,
        },
      });

      if (error) {
        console.error('Failed to grant Discord role:', error);
        toast.error('ไม่สามารถแอดยศ Discord ได้ กรุณาติดต่อแอดมิน');
        return false;
      }

      if (data?.error) {
        console.error('Role grant error:', data.error);
        toast.error(data.message || 'ไม่สามารถแอดยศได้');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error calling grant-discord-role:', error);
      return false;
    }
  }, [user?.discord_id]);
 
  const handleRedeem = useCallback(async () => {

    if (!user?.discord_id) {
      setRedeemStatus('error');
      setRedeemMessage('ยังไม่พบข้อมูลผู้ใช้ในระบบ');
      return;
    }

    const trimmedCode = redeemCode.trim();
    if (!trimmedCode) {
      setRedeemStatus('error');
      setRedeemMessage(redeemErrorMessages.missing_code);
      return;
    }

    setRedeemStatus('loading');
    setRedeemMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { userId: user.discord_id, code: trimmedCode },
      });

      if (error) throw error;

      // Handle known errors from API (these are NOT network errors, don't retry)
      if (!data.ok) {
        const errorKey = data.error || 'code_invalid';
        const fallbackMessage = redeemErrorMessages.invalid_code;
        const errorMsg = redeemErrorMessages[errorKey as keyof typeof redeemErrorMessages] || fallbackMessage;
        setRedeemStatus('error');
        setRedeemMessage(errorMsg);
        // Show error popup for user-facing errors
        setRewardPopup({ type: 'points', message: errorMsg });
        setRewardPopupOpen(true);
        return;
      }

      // Handle role granting if the code includes a role reward
      if (data.granted?.roleGranted) {
        await grantDiscordRole(data.granted.roleGranted);
      }

      // Fetch role details if a role was granted
      let roleName: string | undefined;
      let roleEmoji: string | undefined;
      let roleColor: string | undefined;

      if (data.granted?.roleGranted) {
        const { data: roleData } = await supabase
          .from('discord_roles')
          .select('display_name, emoji, color')
          .eq('discord_role_id', data.granted.roleGranted)
          .maybeSingle();

        if (roleData) {
          roleName = roleData.display_name;
          roleEmoji = roleData.emoji ?? undefined;
          roleColor = roleData.color ?? undefined;
        }

        if (!roleName || !roleEmoji) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: apiData } = await supabase.functions.invoke('discord-roles', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const match = (apiData?.roles ?? []).find(
                (r: { id: string }) => r.id === data.granted?.roleGranted,
              );
              if (match) {
                roleName = roleName || match.name;
                roleEmoji = roleEmoji || match.icon || match.unicode_emoji || undefined;
                roleColor = roleColor || match.color || undefined;
              }
            }
          } catch {
            // ignore – fallback gracefully
          }
        }
      }

      const rawRedeem = data.pointsNow ?? (typeof data.points === 'number' ? data.points : Number(data.points));
      const nextRedeem = Number.isFinite(rawRedeem) ? rawRedeem : points;
      setPoints(Math.min(nextRedeem, maxCap));
      setRedeemStatus('success');
      const rewardMessage = buildRewardMessage(data.granted);
      setRedeemMessage(rewardMessage);
      setRewardPopup({
        type: buildRewardType(data.granted),
        pointsAdded: data.granted?.pointsAdded,
        roleName,
        roleEmoji,
        roleColor,
        message: rewardMessage,
      });
      setRewardPopupOpen(true);
      setRedeemCode('');

      fetchPoints({ showLoading: false });
    } catch {
      setRedeemStatus('error');
      const errorMsg = 'ระบบขัดข้อง กรุณาลองใหม่';
      setRedeemMessage(errorMsg);
      setRewardPopup({ type: 'points', message: errorMsg });
      setRewardPopupOpen(true);
    }
  }, [redeemCode, redeemErrorMessages, fetchPoints, points, user?.discord_id, grantDiscordRole, maxCap]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  useEffect(() => {
    if (!user?.discord_id) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchPoints({ showLoading: false });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [fetchPoints, user?.discord_id]);

  const isLoading = status === 'loading';
  const isRedeeming = redeemStatus === 'loading';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-rose-50 via-pink-50/50 to-cream dark:from-background dark:via-background dark:to-muted/20">

      <div className="flex-1 flex relative z-10">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-full bg-white dark:bg-mocha shadow-lg flex items-center justify-center border border-rose-200 dark:border-coffee/30"
          aria-label="เปิดเมนู"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar - Desktop */}
        <div className="hidden lg:block sticky top-0 h-screen">
          <HomeSidebar onlineCount={null} memberCount={memberCount} />
        </div>

        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50 w-[280px] max-w-[85vw] h-full">
              <HomeSidebar onlineCount={null} memberCount={memberCount} />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 pt-16 lg:pt-10 lg:p-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <motion.div 
              className="flex flex-col gap-2 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="self-start -ml-2 mb-1"
                aria-label="กลับหน้าหลัก"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-display font-bold bg-gradient-to-r from-rose-600 via-pink-500 to-red-400 bg-clip-text text-transparent">
                  แต้มของฉัน ʕ •ᴥ• ʔ
                </h1>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                สะสมสตอเบอรี่เพื่อแลกรางวัลพิเศษ
              </p>
            </motion.div>

            {/* Strawberry Jar Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-rose-200/60 dark:border-coffee/40 bg-gradient-to-br from-white/90 via-rose-50/50 to-pink-50/50 dark:from-card/90 dark:to-card/70 backdrop-blur-sm shadow-xl overflow-hidden">
                <CardContent className="p-6 sm:p-10">
                  <div className="flex flex-col items-center gap-6">
                    {/* Strawberry Jar */}
                    <StrawberryJar 
                      points={points}
                      maxPoints={maxCap}
                      isLoading={isLoading}
                    />

                    {/* Status Messages */}
                    <div className="w-full flex flex-col items-center gap-3">
                      {status === 'loading' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="w-4 h-4 animate-pulse text-rose-400" />
                          <span>กำลังนับสตอเบอรี่...</span>
                        </div>
                      )}
                      {status === 'success' && message && (
                        <p className="text-sm text-muted-foreground">{message}</p>
                      )}
                      {status === 'error' && (
                        <p className="text-sm text-destructive text-center">{message || DEFAULT_ERROR_MESSAGE}</p>
                      )}

                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Redeem Code Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-rose-200/60 dark:border-coffee/40 bg-gradient-to-br from-white/90 to-rose-50/50 dark:from-card/90 dark:to-card/70 backdrop-blur-sm shadow-lg overflow-hidden">
                <CardContent className="p-6 sm:p-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-md">
                      <Gift className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-semibold text-foreground">กรอกโค้ดรับสตอเบอรี่</h2>
                      <p className="text-sm text-muted-foreground">รับสตอเบอรี่และรางวัลพิเศษจากกิจกรรม</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      value={redeemCode}
                      onChange={(event) => setRedeemCode(event.target.value)}
                      placeholder="พิมพ์โค้ดของคุณ..."
                      className="flex-1 rounded-full border-rose-200 dark:border-coffee/40 focus:border-rose-400 focus:ring-rose-400/20"
                      onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                    />
                    <Button
                      onClick={handleRedeem}
                      disabled={isRedeeming}
                      className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold px-6 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30"
                    >
                      {isRedeeming ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                          กำลังตรวจสอบ...
                        </>
                      ) : (
                        <>
                          <Gift className="w-4 h-4 mr-2" />
                          ยืนยันโค้ด
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="min-h-[2rem] flex items-center justify-center">
                    {redeemStatus === 'success' && redeemMessage && (
                      <motion.p 
                        className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {redeemMessage}
                      </motion.p>
                    )}
                    {redeemStatus === 'error' && (
                      <motion.p 
                        className="text-sm font-medium text-destructive flex items-center gap-2"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <XCircle className="w-4 h-4" />
                        {redeemMessage}
                      </motion.p>
                    )}
                    {redeemStatus === 'loading' && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 animate-pulse text-rose-400" />
                        กำลังตรวจสอบโค้ด...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Fun Info Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-sm text-muted-foreground py-4"
            >
            </motion.div>
          </div>
        </main>
      </div>

      <RewardPopup
        open={rewardPopupOpen}
        onOpenChange={(open) => {
          setRewardPopupOpen(open);
          if (!open) setRewardPopup(null);
        }}
        reward={rewardPopup}
      />

      <Footer />
    </div>
  );
}
