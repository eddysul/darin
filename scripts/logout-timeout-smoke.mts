import assert from "node:assert/strict";
import { settleWithin } from "../src/utils/settleWithin.ts";

assert.equal(await settleWithin(Promise.resolve("finished"), 100), "finished");
await assert.rejects(
  settleWithin(new Promise<never>(() => undefined), 20),
  /Operation timed out/,
);
console.log("Logout timeout smoke passed");
