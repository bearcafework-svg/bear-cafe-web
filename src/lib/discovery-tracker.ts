/**
 * Discovery Event Tracker for /discord-servers
 * Plan 1 — Discord Discovery Foundation (Phase 4)
 *
 * Tracks funnel events: view, click, save, unsave, search, category_view, bump
 * Fire-and-forget without blocking UI rendering or navigation.
 */

import { supabase } from '@/integrations/supabase/client';

export type DiscoveryEventType =
  | 'impression'
  | 'view'
  | 'click'
  | 'save'
  | 'unsave'
  | 'search'
  | 'category_view'
  | 'bump';

export interface DiscoveryEventParams {
  event_type: DiscoveryEventType;
  server_id?: string | null;
  user_id?: string | null;
  source?: 'recommendation' | 'trending' | 'rising' | 'new' | 'recent' | 'rating' | 'popular' | 'search' | 'saved' | 'carousel' | string;
  metadata?: Record<string, any>;
}

// ─── Shared Discovery & Growth Constants (Rule 7) ─────────────────────────────
export const DISCOVERY_CONSTANTS = {
  MIN_ENGAGEMENT_SAMPLE: 8,
  MIN_CLICKS_SAMPLE: 5,
  MIN_SAVES_SAMPLE: 2,
  MIN_GROWTH_RATE: 0.50, // +50% week-over-week
  TRENDING_SCORE_THRESHOLD: 8.0,
  NEW_SERVER_DAYS: 14,
} as const;

/**
 * Shared Growth & Rising Calculation Function
 * Used in client-side fallback and verification to match RPC 100%
 */
export function calculateRisingGrowth(
  clicksCurrent: number,
  savesCurrent: number,
  clicksPrevious: number,
  savesPrevious: number
): {
  current_engagement: number;
  previous_engagement: number;
  growth_rate: number | null;
  is_new_breakout: boolean;
  is_rising: boolean;
} {
  const currentEngagement = clicksCurrent * 1.0 + savesCurrent * 3.0;
  const previousEngagement = clicksPrevious * 1.0 + savesPrevious * 3.0;

  const samplePassed =
    currentEngagement >= DISCOVERY_CONSTANTS.MIN_ENGAGEMENT_SAMPLE ||
    clicksCurrent >= DISCOVERY_CONSTANTS.MIN_CLICKS_SAMPLE ||
    savesCurrent >= DISCOVERY_CONSTANTS.MIN_SAVES_SAMPLE;

  if (previousEngagement === 0) {
    const isNewBreakout = currentEngagement >= DISCOVERY_CONSTANTS.MIN_ENGAGEMENT_SAMPLE;
    return {
      current_engagement: currentEngagement,
      previous_engagement: 0,
      growth_rate: null, // Rule 6: Do not report 100% when previous is 0
      is_new_breakout: isNewBreakout,
      is_rising: isNewBreakout,
    };
  }

  const growthRate = (currentEngagement - previousEngagement) / previousEngagement;
  const isRising = samplePassed && growthRate >= DISCOVERY_CONSTANTS.MIN_GROWTH_RATE;

  return {
    current_engagement: currentEngagement,
    previous_engagement: previousEngagement,
    growth_rate: Number(growthRate.toFixed(4)),
    is_new_breakout: false,
    is_rising: isRising,
  };
}

/**
 * Get or create an anonymous device/session ID for anonymous funnel analytics
 */
function getOrCreateSessionId(): string {
  try {
    const key = 'bear_discovery_session_id';
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return 'sess_fallback_' + Date.now();
  }
}

/**
 * Track an individual discovery event
 */
export async function trackDiscoveryEvent({
  event_type,
  server_id,
  user_id,
  source,
  metadata = {},
}: DiscoveryEventParams): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const payloadMetadata = source ? { ...metadata, source } : metadata;
    await (supabase.from('server_discovery_events' as any).insert({
      event_type,
      server_id: server_id || null,
      user_id: user_id || null,
      session_id: sessionId,
      metadata: payloadMetadata,
    } as any)) as any;
  } catch (err) {
    // Non-blocking: Silently handle tracking errors in production
    console.debug('[DiscoveryTracker]', event_type, err);
  }
}

/**
 * Debounced search event tracker
 * Avoids logging every single keystroke; logs 1.2s after user stops typing
 */
let searchDebounceTimeout: any = null;

export function trackSearchIntent(
  query: string,
  category: string,
  resultsCount: number,
  userId?: string | null
) {
  const trimmed = query.trim();
  if (!trimmed) return;

  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout);
  }

  searchDebounceTimeout = setTimeout(() => {
    trackDiscoveryEvent({
      event_type: 'search',
      user_id: userId || null,
      metadata: {
        query: trimmed,
        category: category || 'all',
        results_count: resultsCount,
      },
    });
  }, 1200);
}
