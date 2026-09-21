import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/babylog/BabySwitcher.tsx", "utf8");
const context = readFileSync("src/context/BabyLogContext.tsx", "utf8");

assert.match(source, /if \(babyId === activeBabyId\) \{[\s\S]*?setOpen\(false\);[\s\S]*?return;/,
  "selecting the active baby closes without an unnecessary hydration");
assert.match(source, /setPendingBabyId\(babyId\);[\s\S]*?setOpen\(false\);[\s\S]*?void switchActiveBaby\(babyId\)/,
  "the modal stops intercepting touches before full hydration finishes");
assert.match(source, /\.catch\(\(cause\) => \{[\s\S]*?setError\([\s\S]*?setOpen\(true\);/,
  "a failed switch restores the sheet with a recoverable error");
assert.match(source, /accessibilityState=\{\{ selected, disabled: busy, busy: pendingBabyId === baby\.id \}\}/,
  "switch rows expose selected, disabled, and busy state");
assert.match(source, /pendingBabyId === baby\.id[\s\S]*?<ActivityIndicator/,
  "an in-flight row has visible progress if the sheet is reopened");
assert.match(context, /const hidePreviousBabyDuringSwitch = useCallback\([\s\S]*?localDataScopeRef\.current = null;[\s\S]*?setStorageReady\(false\);[\s\S]*?setLogs\(\[\]\);[\s\S]*?setGrowthRecords\(\[\]\);/,
  "switch hides previous scope before the next baby profile becomes visible");
assert.match(context, /hidePreviousBabyDuringSwitch\(\);\s*applyBabyRowToLocalProfile\(selected\);/,
  "selected baby profile is applied only after previous-scope data is hidden");

console.log("Baby switcher responsiveness smoke: PASS");
