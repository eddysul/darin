import assert from "node:assert/strict";
import {
  clampMemoryMediaTranslation,
  clampMemoryMediaZoom,
  memoryMediaPinchTranslation,
} from "../src/utils/memoryMediaZoom.ts";

assert.equal(clampMemoryMediaZoom(0.5), 1);
assert.equal(clampMemoryMediaZoom(2.5), 2.5);
assert.equal(clampMemoryMediaZoom(8), 4);
assert.equal(clampMemoryMediaTranslation(400, 2, 300), 150);
assert.equal(clampMemoryMediaTranslation(-400, 2, 300), -150);
assert.equal(clampMemoryMediaTranslation(30, 1, 300), 0);

assert.equal(memoryMediaPinchTranslation({
  focal: 0,
  startTranslation: 0,
  startZoom: 1,
  nextZoom: 2,
  viewport: 300,
}), 0);
assert.equal(memoryMediaPinchTranslation({
  focal: 60,
  startTranslation: 0,
  startZoom: 1,
  nextZoom: 2,
  viewport: 300,
}), -60);

console.log("PASS memory media pinch zoom bounds, focal anchoring, and translation clamping");
