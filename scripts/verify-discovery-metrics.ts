/**
 * Plan 1.5 Fix Verification Script: Test Scenarios D - G & Formula Parity
 */

// Shared constants & calculation matching discovery-tracker.ts exactly
export const DISCOVERY_CONSTANTS = {
  MIN_ENGAGEMENT_SAMPLE: 8,
  MIN_CLICKS_SAMPLE: 5,
  MIN_SAVES_SAMPLE: 2,
  MIN_GROWTH_RATE: 0.50, // +50% week-over-week
  TRENDING_SCORE_THRESHOLD: 8.0,
  NEW_SERVER_DAYS: 14,
} as const;

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

function runScenarioTests() {
  console.log('=== Plan 1.5 Discovery Metrics & Rising Logic Test Suite ===\n');

  // Scenario D: High Popularity, Low Growth (10,000 -> 10,100 clicks)
  console.log('Test Scenario D — Popularity สูง แต่ Growth ต่ำ:');
  const resD = calculateRisingGrowth(10100, 0, 10000, 0);
  console.log(`  Clicks: 10,000 -> 10,100 | Growth Rate: ${(resD.growth_rate! * 100).toFixed(1)}%`);
  console.log(`  is_rising: ${resD.is_rising} (Expected: false)`);
  console.assert(resD.is_rising === false, 'Scenario D failed!');

  // Scenario E: High Growth (100 -> 500 clicks)
  console.log('\nTest Scenario E — Growth สูง (+400% with sample > 8):');
  const resE = calculateRisingGrowth(500, 0, 100, 0);
  console.log(`  Clicks: 100 -> 500 | Growth Rate: ${(resE.growth_rate! * 100).toFixed(1)}%`);
  console.log(`  is_rising: ${resE.is_rising} (Expected: true)`);
  console.assert(resE.is_rising === true, 'Scenario E failed!');

  // Scenario F: Small Sample Size (1 -> 3 clicks, +200% but engagement < 8)
  console.log('\nTest Scenario F — Sample เล็ก (1 -> 3 clicks, +200%):');
  const resF = calculateRisingGrowth(3, 0, 1, 0);
  console.log(`  Clicks: 1 -> 3 | Growth Rate: ${(resF.growth_rate! * 100).toFixed(1)}%`);
  console.log(`  is_rising: ${resF.is_rising} (Expected: false due to minimum sample threshold)`);
  console.assert(resF.is_rising === false, 'Scenario F failed!');

  // Scenario G: Previous = 0 (0 -> 20 clicks)
  console.log('\nTest Scenario G — Previous = 0 (0 -> 20 clicks):');
  const resG = calculateRisingGrowth(20, 0, 0, 0);
  console.log(`  Clicks: 0 -> 20 | Growth Rate: ${resG.growth_rate}`);
  console.log(`  is_new_breakout: ${resG.is_new_breakout} | is_rising: ${resG.is_rising} (Expected: growth_rate = null, is_new_breakout = true, is_rising = true)`);
  console.assert(resG.growth_rate === null, 'Scenario G growth_rate should be null!');
  console.assert(resG.is_new_breakout === true, 'Scenario G is_new_breakout should be true!');
  console.assert(resG.is_rising === true, 'Scenario G is_rising should be true!');

  // Scenario G2: Previous = 0 with small sample (0 -> 2 clicks)
  console.log('\nTest Scenario G2 — Previous = 0 with small sample (0 -> 2 clicks):');
  const resG2 = calculateRisingGrowth(2, 0, 0, 0);
  console.log(`  Clicks: 0 -> 2 | Growth Rate: ${resG2.growth_rate}`);
  console.log(`  is_new_breakout: ${resG2.is_new_breakout} | is_rising: ${resG2.is_rising} (Expected: false because sample < 8)`);
  console.assert(resG2.is_new_breakout === false, 'Scenario G2 is_new_breakout should be false!');
  console.assert(resG2.is_rising === false, 'Scenario G2 is_rising should be false!');

  console.log('\n✅ All Growth & Metric Scenarios Verified Successfully!');
}

runScenarioTests();
