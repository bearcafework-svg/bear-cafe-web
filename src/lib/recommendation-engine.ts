/**
 * Personalized Recommendation Engine Helper
 * Plan 2 — Personalized Discovery
 *
 * Implements Rule + Weighted Scoring, Time Decay, Confidence, and Fallbacks
 * Single Source of Truth matching Database RPC get_personalized_recommendations
 */

export const RECOMMENDATION_CONSTANTS = {
  // Weights (Rule 5 & Section 1)
  PERSONAL_MATCH_WEIGHT: 0.60,
  DISCOVERY_QUALITY_WEIGHT: 0.25,
  LISTING_FRESHNESS_WEIGHT: 0.15,

  // Action Event Weights (Meaningful vs Weak)
  SAVE_WEIGHT: 5.0,
  CLICK_WEIGHT: 4.0,
  RATING_WEIGHT: 3.0,
  VIEW_WEIGHT: 2.0,
  SEARCH_WEIGHT: 1.5,
  IMPRESSION_WEIGHT: 0.0,

  // Meaningful Evidence Weights for User State Classification
  EVIDENCE_SAVE: 1.0,
  EVIDENCE_CLICK: 1.0,
  EVIDENCE_RATING: 0.8,
  EVIDENCE_VIEW: 0.8,
  EVIDENCE_SEARCH: 0.5,
  EVIDENCE_IMPRESSION: 0.0,

  // Time Decays (Half-life in Days)
  INTEREST_HALF_LIFE_DAYS: 7.0,
  EXPOSURE_PENALTY_HALF_LIFE_DAYS: 3.0,
  LISTING_FRESHNESS_SCALE_DAYS: 14.0,
  LOOKBACK_WINDOW_DAYS: 30,

  // Exposure Penalties (Intent-based)
  PENALTY_SAVE: 0.50,
  PENALTY_CLICK: 0.35,
  PENALTY_VIEW: 0.15,
  PENALTY_IMPRESSION: 0.00,

  // Exploration & Target Ratios
  TARGET_PERSONALIZED_RATIO: 0.85,
  TARGET_EXPLORATION_RATIO: 0.15,

  // User State Thresholds (Evidence Count)
  NEW_USER_MAX_EVIDENCE: 3.0,
  EARLY_USER_MAX_EVIDENCE: 8.0,
} as const;

export type UserStateType = 'NEW' | 'EARLY' | 'ESTABLISHED';

export interface RecommendationResult {
  server_id: string;
  recommendation_score: number;
  recommendation_reason: string;
  is_exploration: boolean;
  user_state: UserStateType;
}

/**
 * Calculate Listing Freshness from listing creation date
 */
export function calculateListingFreshness(createdAt?: string | null): number {
  if (!createdAt) return 0.1;
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const daysSince = Math.max(0, (now - created) / (1000 * 60 * 60 * 24));
  return Math.exp(-daysSince / RECOMMENDATION_CONSTANTS.LISTING_FRESHNESS_SCALE_DAYS);
}

/**
 * Normalize Discovery Score into [0.0, 1.0] Range deterministically
 */
export function normalizeDiscoveryQuality(discoveryScore?: number | null): number {
  const score = Math.max(0, discoveryScore || 0);
  return 1.0 - 1.0 / (1.0 + score / 15.0);
}

/**
 * Compute Decayed Exposure Penalty based on time since action
 */
export function calculateDecayedPenalty(
  action: 'save' | 'click' | 'view' | 'impression',
  actionTime: number
): number {
  const basePenalty =
    action === 'save'
      ? RECOMMENDATION_CONSTANTS.PENALTY_SAVE
      : action === 'click'
      ? RECOMMENDATION_CONSTANTS.PENALTY_CLICK
      : action === 'view'
      ? RECOMMENDATION_CONSTANTS.PENALTY_VIEW
      : RECOMMENDATION_CONSTANTS.PENALTY_IMPRESSION;

  if (basePenalty <= 0) return 0.0;

  const now = Date.now();
  const daysSince = Math.max(0, (now - actionTime) / (1000 * 60 * 60 * 24));
  const decayed =
    basePenalty *
    Math.pow(2.0, -daysSince / RECOMMENDATION_CONSTANTS.EXPOSURE_PENALTY_HALF_LIFE_DAYS);

  return Math.max(0.0, decayed);
}
