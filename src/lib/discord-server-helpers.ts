// src/lib/discord-server-helpers.ts
// Shared utilities for Discord Server scoring, highlight effects, and time calculation
import type React from 'react';

export interface DiscordServerScoringData {
  id: string;
  name: string;
  bump_count?: number | null;
  bumped_at?: string | null;
  recent_clicks?: number | null;
  is_partner?: boolean | null;
  is_verified?: boolean | null;
  highlight_color?: string | null;
}

export interface WeeklyActiveScoreResult {
  score: number;
  badge: {
    text: string;
    color: string;
  };
}

/**
 * คำนวณคะแนนกิจกรรมรอบ 7 วันล่าสุด (Zero Fiction - Real Database Metrics 100%)
 */
export function calculateWeeklyActiveScore(server: DiscordServerScoringData): WeeklyActiveScoreResult {
  // 1. จำนวนครั้งที่ดันในระบบ (Primary Activity Factor)
  const bumpScore = (server.bump_count || 1) * 10.0;

  // 2. ความสนใจในรอบ 7 วันล่าสุด (Recent Clicks จาก server_click_stats)
  // ไม่ใช้ยอดสะสมตลอดกาล เพื่อป้องกันปัญหาการผูกขาดของเซิร์ฟเวอร์เก่า
  const recentClicks = server.recent_clicks || 0;
  const clickScore = recentClicks * 2.0;

  // 3. ความสดใหม่ของการดันล่าสุด (Time-decay freshness)
  const hoursSinceBump = server.bumped_at
    ? Math.max(0, (Date.now() - new Date(server.bumped_at).getTime()) / 3600000)
    : 168; // เกิน 7 วัน = 0 คะแนนความสด
  const freshnessScore = Math.max(0, 20.0 - (hoursSinceBump / 24) * 2.5);

  // 4. โบนัสพาร์ทเนอร์ และการยืนยันตัวตน
  const partnerBonus = server.is_partner ? 5.0 : 0;
  const verifiedBonus = server.is_verified ? 3.0 : 0;

  const totalScore = bumpScore + clickScore + freshnessScore + partnerBonus + verifiedBonus;

  // ป้ายบอกข้อมูลกิจกรรมจริง
  if (recentClicks >= 5) {
    return {
      score: totalScore,
      badge: {
        text: `👀 สนใจ ${recentClicks} ครั้ง (สัปดาห์นี้)`,
        color: 'bg-blue-600/90 text-white border-blue-400/40 shadow-blue-950/40',
      },
    };
  }

  return {
    score: totalScore,
    badge: {
      text: `🔥 ${server.bump_count || 1} ดัน`,
      color: 'bg-black/65 text-orange-300 border-white/20 shadow-md',
    },
  };
}

/**
 * คำนวณระยะเวลาภาษาไทย เช่น 'เมื่อสักครู่', '2 ชม. ที่แล้ว', '3 วันที่แล้ว'
 */
export function getTimeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return 'ไม่เคยดัน';
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'เมื่อสักครู่';
  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

/**
 * คำนวณเวลาที่เหลือก่อนหลุดรอบ Cooldown (เช่น 7 วัน)
 */
export function getRemainingTime(dateStr: string | null | undefined, windowDays = 7): string {
  if (!dateStr) return 'หมดอายุแล้ว';
  const expireMs = new Date(dateStr).getTime() + windowDays * 24 * 60 * 60 * 1000;
  const rem = expireMs - Date.now();
  if (rem <= 0) return 'หมดอายุแล้ว';
  const hours = Math.floor(rem / (1000 * 60 * 60));
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return d > 0 ? `${d} วัน ${h} ชม.` : `${h} ชม.`;
}

/**
 * เช็คว่าเป็นสีรุ้ง Rainbow หรือไม่
 */
export function isRainbow(color: string | null | undefined): boolean {
  return color === 'rainbow';
}

/**
 * สไตล์ขอบการ์ดและเงาเรืองแสง (Glow Border)
 */
export function getHighlightCardStyle(color: string | null | undefined): React.CSSProperties {
  if (!color) return {};
  if (color === 'rainbow') return {}; // Handled via CSS class .rainbow-border-glow
  return {
    borderColor: color,
    borderWidth: 2,
    boxShadow: `0 0 16px -2px ${color}40`,
  };
}

/**
 * คลาสสำหรับชื่อเซิร์ฟเวอร์ (เช่น Rainbow Shimmer)
 */
export function getNameHighlightClass(color: string | null | undefined): string {
  if (!color) return '';
  if (color === 'rainbow') {
    return 'rainbow-text-shimmer font-extrabold drop-shadow-sm';
  }
  return 'font-bold drop-shadow-sm';
}

/**
 * สไตล์สีตัวอักษรสำหรับชื่อเซิร์ฟเวอร์
 */
export function getNameHighlightStyle(color: string | null | undefined): React.CSSProperties {
  if (!color || color === 'rainbow') return {};
  return {
    color: color,
    textShadow: `0 0 12px ${color}55`,
  };
}
