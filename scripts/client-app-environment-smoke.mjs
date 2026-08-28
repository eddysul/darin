import assert from "node:assert/strict";
import { QA_PROJECT_REF } from "./lib/qa-project-config.mjs";
import { qaClientEnvironment } from "./lib/client-app-environment.mjs";

const environment = qaClientEnvironment(`
EXPO_PUBLIC_SUPABASE_URL=https://${QA_PROJECT_REF}.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-test
SUPABASE_SECRET_KEY=example-server-secret
`, {
  EXPO_PUBLIC_SUPABASE_URL: "https://production.example.invalid",
  SUPABASE_ACCESS_TOKEN: "must-not-pass-through",
  PATH: "/usr/bin",
});

assert.equal(environment.EXPO_PUBLIC_SUPABASE_URL, `https://${QA_PROJECT_REF}.supabase.co`);
assert.equal(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "public-test");
assert.equal(environment.EXPO_PUBLIC_FEATURE_ENV, "qa");
assert.equal(environment.EXPO_PUBLIC_FEATURE_PROFILE, "internal");
assert.equal(environment.EXPO_NO_DOTENV, "1");
assert.equal(environment.SUPABASE_SECRET_KEY, undefined);
assert.equal(environment.SUPABASE_ACCESS_TOKEN, undefined);
assert.equal(environment.PATH, "/usr/bin");
assert.throws(() => qaClientEnvironment(`
EXPO_PUBLIC_SUPABASE_URL=https://production.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-test
`), /LOCAL APP SAFETY BLOCK/);

console.log("QA client app environment smoke passed");
