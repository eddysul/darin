import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickerWheelIndex, pickerWheelOffset } from "../src/utils/pickerWheel.ts";

assert.equal(pickerWheelIndex(0, 44, 60), 0);
assert.equal(pickerWheelIndex(21, 44, 60), 0);
assert.equal(pickerWheelIndex(23, 44, 60), 1);
assert.equal(pickerWheelIndex(44 * 100, 44, 60), 59);
assert.equal(pickerWheelIndex(Number.NaN, 44, 60), 0);
assert.equal(pickerWheelOffset(17, 44), 748);
assert.equal(pickerWheelOffset(-2, 44), 0);

const focusedScroll = readFileSync("src/components/inputs/FocusedInputScrollView.tsx", "utf8");
assert.match(focusedScroll, /automaticallyAdjustKeyboardInsets = Platform\.OS === "ios"/);
assert.match(focusedScroll, /measureInWindow/);
assert.match(focusedScroll, /event\.endCoordinates\.screenY/);
assert.match(focusedScroll, /scrollY\.current \+ overlap/);
assert.match(focusedScroll, /keyboardDidChangeFrame/);
assert.match(focusedScroll, /keyboardDismissMode = Platform\.OS === "ios" \? "interactive" : "on-drag"/);

for (const file of [
  "src/components/babylog/RecordDetailSheet.tsx",
  "src/components/babylog/GrowthRecordModal.tsx",
  "src/components/babylog/QuickRecordEditorSheet.tsx",
  "src/components/babylog/AddCustomCategorySheet.tsx",
  "src/components/babylog/ContractionTimerSheet.tsx",
  "src/components/babylog/ConsultMemoSheet.tsx",
]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /FocusedInputScrollView/, `${file} must keep focused fields visible`);
  assert.doesNotMatch(source, /Platform\.OS === "ios" \? "padding" : "height"/, `${file} must not move the entire iOS sheet`);
}

for (const file of [
  "src/components/inputs/TimePickerFields.tsx",
  "src/components/babylog/RecordDatePickerModal.tsx",
]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /snapToInterval/);
  assert.match(source, /decelerationRate="fast"/);
  assert.match(source, /scrollEventThrottle=\{16\}/);
  assert.match(source, /onMomentumScrollEnd/);
}
assert.doesNotMatch(
  readFileSync("src/components/inputs/TimePickerFields.tsx", "utf8"),
  /contentOffset=\{/,
  "controlled contentOffset must not reset the wheel during an active gesture",
);

console.log("Record keyboard visibility and picker interaction QA PASS");
