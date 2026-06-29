import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { GreenTeaWarningPopup } from "@/components/bear-cafe/GreenTeaWarningPopup";
import { CooldownBox } from "@/components/bear-cafe/CooldownBox";
import { LoadingBear } from "@/components/bear-cafe/LoadingBear";
import { CozySidebar } from "@/components/bear-cafe/CozySidebar";
import { CheckInDayCard, DayRewardDisplay } from "@/components/bear-cafe/CheckInDayCard";
import { CheckinSelectedDayReward } from "@/components/bear-cafe/CheckinSelectedDayReward";
import { CheckinRewardModal, type CheckinRewardModalData } from "@/components/bear-cafe/CheckinRewardModal";
import {
  CheckinMakeupConfirmModal,
  type CheckinMakeupConfirmModalData,
} from "@/components/bear-cafe/CheckinMakeupConfirmModal";
import {
  CheckinMakeupSuccessModal,
  type CheckinMakeupSuccessModalData,
} from "@/components/bear-cafe/CheckinMakeupSuccessModal";
import { useCooldown } from "@/hooks/useCooldown";
import { useCheckin, type CheckinActionResult } from "@/hooks/useCheckin";
import {
  CHECKIN_ERROR_MESSAGES,
  CHECKIN_MONTH_NAMES,
  computeCheckinStreak,
  computeMissedCheckinDays,
  formatSelectedDayRewardSubtitle,
  getCheckinDayState,
  getCheckinToday,
  REWARD_TYPE_LABELS,
  type CheckinDailyReward,
} from "@/lib/checkin";
import { buildRewardModalData, type RoleMeta } from "@/lib/checkin-modal-data";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Loader2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CaffeLatteIcon } from "@/icon/outline";
import { IconDisplay } from "@/components/bear-cafe/IconDisplay";
import { toast } from "sonner";
import { BrokenHeartIcon, Calendar2Icon, FireIcon } from "@/icon/inline";

const ALL_CHECKIN_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function FullCheckInCalendar() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const { isOnCooldown, formattedTime, remainingMinutes } = useCooldown(
    user?.id ?? null,
  );

  const { status, loading, acting, performCheckin, performMakeupCheckin } = useCheckin(
    user?.discord_id,
  );

  const [rewardModal, setRewardModal] = useState<CheckinRewardModalData | null>(null);
  const [makeupModal, setMakeupModal] = useState<CheckinMakeupConfirmModalData | null>(null);
  const [makeupSuccessModal, setMakeupSuccessModal] = useState<CheckinMakeupSuccessModalData | null>(null);
  const [roleMeta, setRoleMeta] = useState<Record<string, RoleMeta>>({});
  const [totalPoints, setTotalPoints] = useState(0);

  const { year, month, day: todayDay } = getCheckinToday();
  const defaultSelectedDay = Math.min(todayDay, 28);
  const [overrideDay, setOverrideDay] = useState<number | null>(null);
  const selectedDay = overrideDay ?? defaultSelectedDay;

  const closeSidebar = () => setSidebarOpen(false);
  const closeRewardModal = useCallback(() => setRewardModal(null), []);
  const closeMakeupModal = useCallback(() => setMakeupModal(null), []);
  const closeMakeupSuccessModal = useCallback(() => setMakeupSuccessModal(null), []);

  useEffect(() => {
    setOverrideDay(null);
  }, [defaultSelectedDay]);

  const completedDays = useMemo(() => {
    if (!status) return new Set<number>();
    return new Set([...status.cycle.completed_days, ...status.cycle.makeup_days]);
  }, [status]);

  const rewardsByDay = useMemo(() => {
    const map = new Map<number, CheckinDailyReward>();
    status?.daily_rewards.forEach((reward) => map.set(reward.day_number, reward));
    return map;
  }, [status]);

  useEffect(() => {
    const roleIds = [
      ...new Set(
        status?.daily_rewards
          .filter((r) => r.reward_type === "role" && r.role_id)
          .map((r) => r.role_id as string),
      ),
    ];
    if (status?.big_reward?.role_id) {
      roleIds.push(status.big_reward.role_id);
    }
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        uniqueRoleIds.map(async (roleId) => {
          try {
            const { data: roleInfo } = await supabase.functions.invoke("get-role-info", {
              body: { role_id: roleId },
            });
            if (roleInfo && !roleInfo.error) {
              const icon = roleInfo.icon || roleInfo.unicode_emoji;
              return [roleId, { icon: icon || undefined, name: roleInfo.name }] as const;
            }
          } catch {
            /* ignore */
          }
          return null;
        }),
      );

      if (!cancelled) {
        setRoleMeta((prev) => ({
          ...prev,
          ...Object.fromEntries(entries.filter(Boolean) as [string, RoleMeta][]),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status?.daily_rewards, status?.big_reward?.role_id]);

  useEffect(() => {
    if (!user?.discord_id) {
      setTotalPoints(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("user_points")
        .select("points")
        .eq("discord_id", user.discord_id)
        .maybeSingle();

      if (!cancelled) {
        setTotalPoints((data as { points?: number } | null)?.points ?? 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.discord_id, status]);

  const streak = computeCheckinStreak(completedDays, todayDay);
  const totalCheckins = completedDays.size;
  const missedThisMonth = computeMissedCheckinDays(completedDays, todayDay);
  const selectedReward = rewardsByDay.get(selectedDay);
  const selectedState = getCheckinDayState(
    selectedDay,
    completedDays,
    todayDay,
    status?.makeup_window_open ?? false,
  );
  const selectedCheckedIn = selectedDay <= 28 && completedDays.has(selectedDay);
  const canClaimSelected =
    isAuthenticated &&
    selectedDay <= 28 &&
    !selectedCheckedIn &&
    selectedReward?.is_active &&
    (selectedState === "today" || selectedState === "makeup");
  const rewardSubtitle = formatSelectedDayRewardSubtitle(selectedState, selectedDay, todayDay);
  const bigReward = status?.big_reward;
  const bigRewardRoleIcon = bigReward?.role_id ? roleMeta[bigReward.role_id]?.icon : undefined;

  const handleActionResult = (result: CheckinActionResult) => {
    if (result.ok === false) {
      const message = CHECKIN_ERROR_MESSAGES[result.error] ?? "ไม่สามารถเช็คอินได้";
      toast.error(message);
      return;
    }

    setRewardModal(buildRewardModalData(result, selectedReward, roleMeta));

    if (result.reward && "role_grant_error" in result.reward) {
      toast.error("เช็คอินสำเร็จแล้ว แต่ไม่สามารถมอบ Role ได้ กรุณาติดต่อแอดมิน");
    }

    if (result.big_reward_granted) {
      toast.success("ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨");
    }
  };

  const openMakeupConfirmModal = () => {
    if (!selectedReward) return;
    const modalData: CheckinMakeupConfirmModalData = {
      type: selectedReward.reward_type,
      pointsAdded: selectedReward.reward_amount ?? undefined,
      makeupCost: selectedReward.makeup_cost ?? 50,
      dayNumber: selectedDay,
    };
    if (selectedReward.reward_type === "role") {
      modalData.roleId = selectedReward.role_id ?? undefined;
      modalData.roleName = selectedReward.role_name ?? undefined;
      const meta = selectedReward.role_id ? roleMeta[selectedReward.role_id] : undefined;
      if (meta) {
        modalData.roleName = modalData.roleName ?? meta.name;
        modalData.roleIcon = meta.icon;
      }
    }
    setMakeupModal(modalData);
  };

  const handleMakeupConfirm = async () => {
    if (!makeupModal) return;
    const { dayNumber, makeupCost } = makeupModal;
    const result = await performMakeupCheckin(dayNumber, year, month);
    if (result.ok === false) {
      const message = CHECKIN_ERROR_MESSAGES[result.error] ?? "ไม่สามารถเติมเช็คอินได้";
      toast.error(message);
      return;
    }
    setMakeupModal(null);
    const rewardData = buildRewardModalData(result, rewardsByDay.get(dayNumber), roleMeta);
    setMakeupSuccessModal({ ...rewardData, makeupCost });

    if (result.reward && "role_grant_error" in result.reward) {
      toast.error("เติมเช็คอินสำเร็จแล้ว แต่ไม่สามารถมอบ Role ได้ กรุณาติดต่อแอดมิน");
    }

    if (result.big_reward_granted) {
      toast.success("ครบ 28 วัน! ได้รับรางวัลใหญ่แล้ว ✨");
    }
  };

  const handleClaimSelected = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (selectedState === "makeup") {
      openMakeupConfirmModal();
      return;
    }
    if (selectedState === "today") {
      const result = await performCheckin(selectedDay);
      handleActionResult(result);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingBear message="กำลังโหลด..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <GreenTeaWarningPopup userId={user?.id} />
      <CooldownBox
        isOnCooldown={isOnCooldown}
        formattedTime={formattedTime}
        remainingMinutes={remainingMinutes}
      />

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center"
        aria-label="เปิดเมนู"
      >
        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      <div className="hidden lg:block shrink-0">
        <CozySidebar />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSidebar}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-50 h-full w-[220px] max-w-[85vw]"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("a, button")) closeSidebar();
              }}
            >
              <CozySidebar />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="min-h-screen flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full min-w-0 flex-col gap-5 px-4 py-6 pt-16 sm:gap-8 sm:px-6 sm:py-8 lg:pt-8 lg:gap-10 min-h-svh">
          <div className="">
            <button
              type="button"
              onClick={() => navigate("/")}
              className={cn(
                "text-[#D7A042] dark:text-[#9A7331] bear-body-regular-medium sm:bear-h2-bold flex items-center gap-1.5 sm:gap-2",
              )}
            >
              <ChevronLeft size={18} className="sm:w-5 sm:h-5 shrink-0" color="#D7A042" />
              <span className="text-[#9A7331] dark:text-[#D7A042]">กลับไปหน้าคาเฟ่</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-5 lg:gap-6 flex-1 w-full min-w-0">
            <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 space-y-3 sm:space-y-4 min-w-0">
              <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                <CaffeLatteIcon size={{ mobile: 24, desktop: 36 }} className="shrink-0" />
                <p className="bear-h3-bold md:bear-h1-bold text-[#89654A] dark:text-[#E9E6E2] leading-tight min-w-0">
                  เช็คอินรายวันเพื่อรับรางวัลพิเศษ!
                </p>
              </div>
              <p className="bear-body-small-regular md:bear-body-regular text-[#94735C] dark:text-[#9D8F7B]">
                เช็คอินรายวันเพื่อรับของขวัญมากมาย ชวนเพื่อนมารับรางวัลกันด้วยน้า
              </p>

              <div className="w-full min-w-0 overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
                {/* TODO - Confirm with graphic for mobile layout */}
                <div className="grid grid-cols-4 md:grid-cols-7 gap-0.5 min-[375px]:gap-1 sm:gap-2 md:gap-3 min-w-[18.5rem] sm:min-w-0 w-full [&_button]:min-w-0">
                  {loading
                    ? Array.from({ length: 28 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square min-h-[4.5rem] animate-pulse rounded-lg bg-[#EDE4D4] dark:bg-[#1A1A1A] sm:rounded-2xl"
                      />
                    ))
                    : ALL_CHECKIN_DAYS.map((day) => {
                      const state = getCheckinDayState(
                        day,
                        completedDays,
                        todayDay,
                        status?.makeup_window_open ?? false,
                      );
                      const reward = rewardsByDay.get(day);
                      return (
                        <CheckInDayCard
                          key={day}
                          day={day}
                          state={state}
                          reward={reward}
                          roleIcon={reward?.role_id ? roleMeta[reward.role_id]?.icon : undefined}
                          isSelected={day === selectedDay}
                          disabled={acting}
                          onClick={() => setOverrideDay(day)}
                        />
                      );
                    })}
                </div>
              </div>

              {status?.makeup_window_open && isAuthenticated && (
                <p className="text-center bear-body-xsmall-regular sm:bear-body-small-regular text-[#D7A042] dark:text-[#D7A042] px-1">
                  ช่วงเติมเช็คอินเปิดแล้ว — คลิกวันที่พลาดเพื่อเติมด้วยแต้ม
                </p>
              )}

              <p className={cn("text-[#94735C] dark:text-[#9D8F7B] bear-body-small-regular md:bear-body-regular")}>
                เช็คอินทุกวันเพื่อรับรางวัลสุดพิเศษ ถ้าพลาดวันไหนก็สามารถรับรางวัลย้อนหลังได้น้า
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[1fr_1fr] gap-3 sm:gap-4 min-w-0">
              <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col gap-3 sm:gap-4 min-w-0">
                <div className="min-w-0">
                  <h2 className="bear-h3-bold md:bear-h2-bold text-[#89654A] dark:text-[#E9E6E2]">
                    รางวัลในวันที่ {selectedDay}
                  </h2>
                  <p className="bear-body-xsmall-regular sm:bear-body-small-regular text-[#94735C] dark:text-[#9D8F7B]">
                    {rewardSubtitle}
                  </p>
                </div>

                <div className="py-0.5 sm:py-1">
                  {selectedReward ? (
                    <CheckinSelectedDayReward
                      reward={selectedReward}
                      roleIcon={
                        selectedReward.role_id ? roleMeta[selectedReward.role_id]?.icon : undefined
                      }
                      roleName={
                        selectedReward.role_id
                          ? roleMeta[selectedReward.role_id]?.name ?? selectedReward.role_name
                          : undefined
                      }
                    />
                  ) : (
                    <p className="bear-body-regular text-[#94735C] dark:text-[#9D8F7B] text-center py-8">
                      ยังไม่มีรางวัลสำหรับวันนี้
                    </p>
                  )}
                </div>

                <p className="bear-body-small-regular-medium sm:bear-body-regular-medium text-[#89654A] dark:text-[#E9E6E2] text-center">
                  ยอดสะสมปัจจุบัน {totalPoints.toLocaleString()} แต้ม
                </p>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="bg-[#1E3A2F] border-[#2D5C48] text-[#E9E6E2] bear-body-regular-medium rounded-full px-6 sm:px-8 py-2.5 sm:py-2 w-full"
                  >
                    เข้าสู่ระบบ
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canClaimSelected || acting || selectedDay > 28}
                    onClick={handleClaimSelected}
                    className={cn(
                      "bear-body-regular-medium rounded-full px-6 sm:px-8 py-2.5 sm:py-2 cursor-pointer border-2 w-full",
                      "bg-[#C7EEC8] dark:bg-[#1E3A2F] border-[#9CCC9E] dark:border-[#2D5C48] text-[#89654A] dark:text-[#E9E6E2] disabled:bg-[#bedebf] dark:disabled:bg-[#0C1511] disabled:border-[#88ae89] dark:disabled:border-[#1E3A2F] disabled:text-[#a3c0a4] dark:disabled:text-[#1E3A2F]",
                    )}
                  >
                    {acting ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : selectedCheckedIn ? (
                      "รับรางวัลแล้ว"
                    ) : selectedDay > 28 ? (
                      "หมดรอบเช็คอิน"
                    ) : selectedState === "makeup" ? (
                      "เติมเช็คอิน"
                    ) : selectedState === "future" ? (
                      "ยังรับรางวัลไม่ได้"
                    ) : selectedState === "missed" ? (
                      "พลาดเช็คอินแล้ว"
                    ) : (
                      "รับรางวัลวันนี้"
                    )}
                  </button>
                )}
              </div>

              <div className="bg-[#FDFAF7] dark:bg-[#101010] border-2 border-[#F4EEE5] dark:border-[#101010] rounded-lg p-3 sm:p-4 md:p-6 lg:p-8 flex flex-col gap-2.5 sm:gap-3 min-w-0 sm:col-span-2 lg:col-span-1">
                <h3 className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-h3-bold md:bear-h2-bold")}>สถิติของคุณ</h3>
                <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <FireIcon size={16} color="#D7A042" className="shrink-0" />
                    <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium truncate")}>
                      เช็คอินต่อเนื่อง
                    </span>
                  </div>
                  <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium shrink-0")}>
                    {streak} วัน
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Calendar2Icon size={16} color="#2D5C48" className="shrink-0" />
                    <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium truncate")}>
                      เช็คอินสะสม
                    </span>
                  </div>
                  <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium shrink-0")}>
                    {totalCheckins} วัน
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[#FAF2E4] border border-[#F4EEE5] dark:bg-[#121212] dark:border-[#242424] rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <BrokenHeartIcon size={16} color="#622F37" className="shrink-0" />
                    <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium truncate")}>
                      พลาดในเดือนนี้
                    </span>
                  </div>
                  <span className={cn("text-[#89654A] dark:text-[#E9E6E2] bear-body-small-regular-medium sm:bear-body-regular-medium shrink-0")}>
                    {missedThisMonth} วัน
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="flex flex-col gap-4 border-t border-border px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="bear-h3-medium">
              <span className="text-[#89654A] dark:text-[#F5F5F5]">Bear</span>{" "}
              <span className="text-[#D7A042] dark:text-[#FAB97D]">Cafe</span>
            </p>
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#A1A1A1]">
              2026 BEAR CAFE by Zeabiu. All rights reserved.
            </p>
          </div>
          <div>
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#A1A1A1]">
              All illustrations, UI designs, layouts, concepts, visual styles,
              and creative elements on this website are protected by copyright
              law.
            </p>
            <p className="bear-body-small-regular text-[#94735C] dark:text-[#A1A1A1]">
              Unauthorized use, reproduction, imitation, or redistribution in
              any form is strictly prohibited.
            </p>
          </div>
        </footer>
      </section>

      <CheckinMakeupConfirmModal
        data={makeupModal}
        confirming={acting}
        onConfirm={handleMakeupConfirm}
        onClose={closeMakeupModal}
      />
      <CheckinMakeupSuccessModal data={makeupSuccessModal} onClose={closeMakeupSuccessModal} />
      <CheckinRewardModal reward={rewardModal} onClose={closeRewardModal} />
    </div>
  );
}
