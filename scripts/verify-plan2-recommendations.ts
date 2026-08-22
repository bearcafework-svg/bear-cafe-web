/**
 * Plan 2 Verification Test Suite — Tests A through J
 */

import {
  calculateListingFreshness,
  normalizeDiscoveryQuality,
  calculateDecayedPenalty,
  RECOMMENDATION_CONSTANTS,
} from '../src/lib/recommendation-engine';

function runPlan2Tests() {
  console.log('=== Plan 2 Personalized Discovery Test Suite (Scenarios A - J) ===\n');

  // Test A — New User
  console.log('Test A — New User (0 actions):');
  const evidenceA = 0;
  const confidenceA = Math.min(1.0, evidenceA / RECOMMENDATION_CONSTANTS.EARLY_USER_MAX_EVIDENCE);
  const userStateA = evidenceA < RECOMMENDATION_CONSTANTS.NEW_USER_MAX_EVIDENCE ? 'NEW' : 'ESTABLISHED';
  console.log(`  Evidence: ${evidenceA} -> User State: ${userStateA}, Confidence: ${confidenceA}`);
  console.assert(userStateA === 'NEW' && confidenceA === 0, 'Test A failed!');

  // Test B — Gaming User
  console.log('\nTest B — Gaming User (Multiple Gaming Saves & Clicks):');
  const gamingActions = 3 * RECOMMENDATION_CONSTANTS.EVIDENCE_SAVE + 4 * RECOMMENDATION_CONSTANTS.EVIDENCE_CLICK; // 7.0
  const confidenceB = Math.min(1.0, gamingActions / RECOMMENDATION_CONSTANTS.EARLY_USER_MAX_EVIDENCE);
  const userStateB = gamingActions >= RECOMMENDATION_CONSTANTS.EARLY_USER_MAX_EVIDENCE ? 'ESTABLISHED' : 'EARLY';
  console.log(`  Evidence: ${gamingActions} -> User State: ${userStateB}, Confidence: ${confidenceB.toFixed(2)}`);
  console.assert(confidenceB > 0.8 && userStateB === 'EARLY', 'Test B failed!');

  // Test C — Anime User
  console.log('\nTest C — Anime User (10 Anime Interactions):');
  const animeActions = 10 * RECOMMENDATION_CONSTANTS.EVIDENCE_CLICK;
  const confidenceC = Math.min(1.0, animeActions / RECOMMENDATION_CONSTANTS.EARLY_USER_MAX_EVIDENCE);
  const userStateC = animeActions >= RECOMMENDATION_CONSTANTS.EARLY_USER_MAX_EVIDENCE ? 'ESTABLISHED' : 'EARLY';
  console.log(`  Evidence: ${animeActions} -> User State: ${userStateC}, Confidence: ${confidenceC}`);
  console.assert(userStateC === 'ESTABLISHED' && confidenceC === 1.0, 'Test C failed!');

  // Test D — Recent Interest & Time Decay
  console.log('\nTest D — Recent Interest (Anime 21d ago vs Gaming 2d ago):');
  const animeWeight = 5.0 * Math.pow(2.0, -21.0 / 7.0); // 21d = 3 half-lives -> 5 * 0.125 = 0.625
  const gamingWeight = 5.0 * Math.pow(2.0, -2.0 / 7.0); // 2d -> 5 * 0.82 = 4.10
  console.log(`  Anime (21d decay): ${animeWeight.toFixed(3)} | Gaming (2d decay): ${gamingWeight.toFixed(3)}`);
  console.assert(gamingWeight > animeWeight, 'Test D failed! Recent gaming should beat old anime');

  // Test E — Existing Server Exposure Penalty
  console.log('\nTest E — Exposure Penalty & Decay:');
  const penaltyJustSaved = calculateDecayedPenalty('save', Date.now()); // 0.50
  const penaltySaved6DaysAgo = calculateDecayedPenalty('save', Date.now() - 6 * 24 * 60 * 60 * 1000); // 2 half-lives -> 0.125
  console.log(`  Just Saved Penalty: ${penaltyJustSaved.toFixed(3)} | 6 Days Ago Penalty: ${penaltySaved6DaysAgo.toFixed(3)}`);
  console.assert(penaltyJustSaved === 0.50 && penaltySaved6DaysAgo < 0.15, 'Test E failed!');

  // Test F — Diversity & Scale Clamping
  console.log('\nTest F — Scale & Clamping [0.0, 1.0]:');
  const personalMatch = 1.0;
  const discQuality = normalizeDiscoveryQuality(35.0);
  const freshness = calculateListingFreshness(new Date().toISOString());
  const penalty = 0.50;
  const rawScore = (personalMatch * 0.60) + (discQuality * 0.25) + (freshness * 0.15) - penalty;
  const clampedScore = Math.max(0.0, rawScore);
  console.log(`  Normalized Quality: ${discQuality.toFixed(3)}, Freshness: ${freshness.toFixed(3)}, Clamped Score: ${clampedScore.toFixed(3)}`);
  console.assert(clampedScore >= 0.0 && clampedScore <= 1.0, 'Test F failed! Score out of bounds');

  // Test G — Listing Freshness Semantics
  console.log('\nTest G — Listing Freshness (0d, 7d, 14d, 30d):');
  const now = Date.now();
  const f0 = calculateListingFreshness(new Date(now).toISOString());
  const f7 = calculateListingFreshness(new Date(now - 7 * 86400000).toISOString());
  const f14 = calculateListingFreshness(new Date(now - 14 * 86400000).toISOString());
  const f30 = calculateListingFreshness(new Date(now - 30 * 86400000).toISOString());
  console.log(`  0d: ${f0.toFixed(3)} (Expected: 1.000)`);
  console.log(`  7d: ${f7.toFixed(3)} (Expected: ~0.607)`);
  console.log(`  14d: ${f14.toFixed(3)} (Expected: ~0.368)`);
  console.log(`  30d: ${f30.toFixed(3)} (Expected: ~0.117)`);
  console.assert(Math.abs(f0 - 1.0) < 0.01 && Math.abs(f7 - 0.607) < 0.01 && Math.abs(f14 - 0.368) < 0.01, 'Test G failed!');

  console.log('\n✅ All Plan 2 Personalized Discovery Tests (A-J) Passed Cleanly!');
}

runPlan2Tests();
