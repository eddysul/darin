import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  growthDirection,
  resolveGrowthSummaryState,
  resolveGrowthTrend,
} from "../src/utils/overviewGrowth.ts";

assert.equal(resolveGrowthTrend(undefined, undefined), "insufficient");
assert.equal(resolveGrowthTrend(6.2, undefined), "insufficient", "one measurement cannot infer a trend");
assert.equal(resolveGrowthTrend(undefined, 6.0), "insufficient", "partial measurement cannot infer a trend");
assert.equal(resolveGrowthTrend(6.2, 6.0), "increase");
assert.equal(resolveGrowthTrend(5.8, 6.0), "decrease");
assert.equal(resolveGrowthTrend(6.0, 6.0), "unchanged");
assert.equal(growthDirection("increase"), "↗");
assert.equal(growthDirection("decrease"), "↘");
assert.equal(growthDirection("unchanged"), "→");
assert.equal(growthDirection("insufficient"), "");

assert.equal(resolveGrowthSummaryState(["insufficient", "insufficient", "insufficient"], false), "insufficient");
assert.equal(resolveGrowthSummaryState(["increase", "increase", "increase"], true), "increase");
assert.equal(resolveGrowthSummaryState(["decrease", "increase"], true), "decrease");
assert.equal(resolveGrowthSummaryState(["unchanged", "unchanged"], false), "unchanged");
assert.equal(resolveGrowthSummaryState(["increase", "unchanged"], false), "mixed");
assert.equal(resolveGrowthSummaryState(["increase", "increase"], false), "increase");
assert.equal(resolveGrowthSummaryState(["increase", "increase", "increase"], false), "increase", "growth can be reported without inventing a milestone");

const growthSection = await readFile(new URL("../src/components/babylog/OverviewGrowthSection.tsx", import.meta.url), "utf8");
assert.match(growthSection, /newestMilestone && allThreeIncrease/, "milestone copy requires an actual milestone and complete increase state");

console.log("overview growth QA: PASS (no data, single, increase, decrease, unchanged, partial, milestone states)");
