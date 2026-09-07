"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  XCircle,
  Bot,
  ShieldCheck,
  Eye,
  RefreshCw,
  Square,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { cn } from "@/lib/utils";

export interface OrderTrackingParallaxCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Order ID or Campaign Reference (Supports standard demo prop)
   * @default '4582'
   */
  orderId?: string;
  /**
   * Product name or Campaign title (Supports standard demo prop)
   * @default 'Broadcast Message'
   */
  product?: string;
  /**
   * Status display text (Supports standard demo prop)
   * @default 'In Transit'
   */
  status?: string;
  /**
   * ETA estimate text (Supports standard demo prop)
   * @default 'Soon'
   */
  eta?: string;

  /* Extended DM Broadcast Campaign Props */
  campaignId?: string;
  title?: string;
  subTitle?: string;
  progress?: number;
  totalTargets?: number;
  sentCount?: number;
  failedCount?: number;
  tokenType?: "token1" | "token2";
  safetyMode?: string;
  statusType?: "pending" | "processing" | "completed" | "paused" | "cancelled";
  onViewLogs?: () => void;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onViewJson?: () => void;
  children?: React.ReactNode;
}

export const OrderTrackingParallaxCard = React.forwardRef<
  HTMLDivElement,
  OrderTrackingParallaxCardProps
>(
  (
    {
      orderId = "4582",
      product = "Wireless Headphones",
      status = "Out for Delivery",
      eta = "Tomorrow, 7 PM",
      campaignId,
      title,
      subTitle,
      progress,
      totalTargets,
      sentCount,
      failedCount,
      tokenType,
      safetyMode,
      statusType = "processing",
      onViewLogs,
      onCancel,
      onPause,
      onResume,
      onRetry,
      onViewJson,
      children,
      className,
      ...props
    },
    ref
  ) => {
    // 3D Parallax tilt motion values
    const cardRef = React.useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 250, damping: 25 });
    const mouseYSpring = useSpring(y, { stiffness: 250, damping: 25 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

    // Glare shine coordinates
    const [glarePos, setGlarePos] = React.useState({ x: 50, y: 50, opacity: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const xPct = mouseX / rect.width - 0.5;
      const yPct = mouseY / rect.height - 0.5;

      x.set(xPct);
      y.set(yPct);

      setGlarePos({
        x: (mouseX / rect.width) * 100,
        y: (mouseY / rect.height) * 100,
        opacity: 0.22,
      });
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
      setGlarePos((prev) => ({ ...prev, opacity: 0 }));
    };

    // Calculate percentage if not directly provided
    const displayProgress =
      typeof progress === "number"
        ? Math.min(100, Math.max(0, Math.round(progress)))
        : totalTargets && totalTargets > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round((((sentCount || 0) + (failedCount || 0)) / totalTargets) * 100)
            )
          )
        : 65;

    const displayTitle = title || product;
    const displayId = campaignId ? campaignId.slice(0, 8).toUpperCase() : orderId;

    // Status config mapping
    const getStatusConfig = () => {
      switch (statusType) {
        case "processing":
          return {
            color: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
            icon: <Send className="w-3.5 h-3.5 animate-pulse text-blue-500" />,
            badgeText: status || "กำลังจัดส่งออกอากาศ...",
            variant: "indigo" as const,
          };
        case "completed":
          return {
            color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
            badgeText: status || "จัดส่งเสร็จสิ้นสมบูรณ์",
            variant: "emerald" as const,
          };
        case "paused":
          return {
            color: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            icon: <PauseCircle className="w-3.5 h-3.5 text-amber-500" />,
            badgeText: status || "พักส่งชั่วคราว",
            variant: "amber" as const,
          };
        case "cancelled":
          return {
            color: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
            icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
            badgeText: status || "ยกเลิกการส่งแล้ว",
            variant: "rose" as const,
          };
        case "pending":
        default:
          return {
            color: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
            badgeText: status || "รอคิวออกอากาศ",
            variant: "amber" as const,
          };
      }
    };

    const statusConfig = getStatusConfig();

    return (
      <div
        ref={ref}
        className={cn("perspective-1000 w-full select-none", className)}
        {...props}
      >
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          className={cn(
            "relative overflow-hidden rounded-3xl p-5 sm:p-6 transition-shadow duration-300",
            "bg-gradient-to-br from-[#FFFDF9] via-[#FAF5EE] to-[#F5ECE0] dark:from-[#231F1C] dark:via-[#1D1917] dark:to-[#161311]",
            "border border-[#EAD8C8] dark:border-[#382F27]",
            "shadow-lg hover:shadow-2xl hover:shadow-amber-500/10"
          )}
        >
          {/* Dynamic Glare Effect */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300 rounded-3xl"
            style={{
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glarePos.opacity}), transparent 55%)`,
            }}
          />

          {/* Card Content with 3D depth */}
          <div className="relative z-10 space-y-4" style={{ transform: "translateZ(20px)" }}>
            {/* Top Bar: Order / Campaign Reference & Status */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-white/80 dark:bg-[#25201C] border-[#EAD8C8] dark:border-[#3D332A] text-[#8C6239] dark:text-[#EAD8C8] font-bold shadow-2xs"
                >
                  #{displayId}
                </Badge>
                {tokenType && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                  >
                    <Bot className="w-3 h-3 mr-1 text-amber-500 inline" />
                    {tokenType === "token2" ? "บอทสำรอง" : "บอทหลัก"}
                  </Badge>
                )}
                {safetyMode && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  >
                    <ShieldCheck className="w-3 h-3 mr-1 text-emerald-500 inline" />
                    {safetyMode === "safe" ? "Safe Mode" : "Balanced"}
                  </Badge>
                )}
              </div>

              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs",
                  statusConfig.color
                )}
              >
                {statusConfig.icon}
                <span>{statusConfig.badgeText}</span>
              </div>
            </div>

            {/* Middle Section: Mascot + Title + ETA Box */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3.5">
                {/* Floating 3D Mascot Graphic */}
                <motion.div
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                  className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-[#8C6239] to-amber-800 p-0.5 shadow-md shrink-0 flex items-center justify-center text-white"
                >
                  <div className="w-full h-full rounded-[14px] bg-[#FAF5EE] dark:bg-[#1E1B18] flex items-center justify-center text-2xl">
                    🐻
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs text-[10px]">
                    📬
                  </div>
                </motion.div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#4E3F30] dark:text-[#E8E1D9] leading-tight">
                    {displayTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subTitle || "ระบบติดตามการส่งข้อความส่วนตัว Discord แบบเรียลไทม์"}
                  </p>
                </div>
              </div>

              {/* ETA Badge Box */}
              {eta && (
                <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shrink-0 shadow-2xs">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
                  <div className="text-left">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      เวลาที่คาดว่าจะเสร็จ (ETA)
                    </span>
                    <span className="text-xs font-bold text-[#8C6239] dark:text-amber-300">
                      {eta}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar & Counters */}
            <div className="space-y-2 bg-white/60 dark:bg-[#1A1715]/60 border border-[#EAD8C8]/80 dark:border-[#2E2620] p-3.5 rounded-2xl backdrop-blur-xs">
              <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                <span className="font-bold text-[#6B5A4B] dark:text-[#EAD8C8] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  ความคืบหน้าการส่ง
                </span>
                <div className="flex items-center gap-3 font-semibold text-xs">
                  {typeof totalTargets === "number" && (
                    <span className="text-muted-foreground">
                      ทั้งหมด: <strong>{totalTargets}</strong> คน
                    </span>
                  )}
                  {typeof sentCount === "number" && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      สำเร็จ: <strong>{sentCount}</strong>
                    </span>
                  )}
                  {typeof failedCount === "number" && failedCount > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">
                      ล้มเหลว: <strong>{failedCount}</strong>
                    </span>
                  )}
                </div>
              </div>

              <ProgressIndicator
                value={displayProgress}
                showLabel={true}
                size="md"
                variant={statusConfig.variant}
              />
            </div>

            {/* Optional Embedded Children (e.g. TaskSteps) */}
            {children && <div className="pt-1">{children}</div>}

            {/* Action Buttons Row */}
            {(onViewLogs || onCancel || onRetry || onViewJson) && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-[#EAD8C8]/60 dark:border-[#2E2620]">
                {onViewJson && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-[#EAD8C8] dark:border-[#2D2520] hover:bg-white dark:hover:bg-[#25201C] cursor-pointer"
                    onClick={onViewJson}
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" /> ตรวจสอบ JSON
                  </Button>
                )}

                {onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer"
                    onClick={onRetry}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> ส่งซ่อมรายการเสีย
                  </Button>
                )}

                {onPause && statusType === "processing" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                    onClick={onPause}
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-500" /> พักส่งชั่วคราว
                  </Button>
                )}

                {onResume && statusType === "paused" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                    onClick={onResume}
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-500" /> ส่งต่อทันที
                  </Button>
                )}

                {onCancel && (statusType === "processing" || statusType === "pending" || statusType === "paused") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
                    onClick={onCancel}
                  >
                    <Square className="w-3 h-3 text-white" /> หยุดส่ง
                  </Button>
                )}

                {onViewLogs && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-[#EAD8C8] dark:border-[#2D2520] hover:bg-white dark:hover:bg-[#25201C] cursor-pointer"
                    onClick={onViewLogs}
                  >
                    ดูบันทึก Log
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
);

OrderTrackingParallaxCard.displayName = "OrderTrackingParallaxCard";

export default OrderTrackingParallaxCard;
