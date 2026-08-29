import assert from "node:assert/strict";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";
import { productionClientEnvironment, qaClientEnvironment } from "./lib/client-app-environment.mjs";

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

const production = productionClientEnvironment(`
EXPO_PUBLIC_SUPABASE_URL=https://${PRODUCTION_PROJECT_REF}.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-prod
EXPO_PUBLIC_INTERNAL_FEATURES=experimentalNotifications
SUPABASE_SECRET_KEY=example-server-secret
`, {
  EXPO_PUBLIC_SUPABASE_URL: "https://qa.example.invalid",
  SUPABASE_ACCESS_TOKEN: "must-not-pass-through",
  PATH: "/usr/bin",
});

assert.equal(production.EXPO_PUBLIC_SUPABASE_URL, `https://${PRODUCTION_PROJECT_REF}.supabase.co`);
assert.equal(production.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "public-prod");
assert.equal(production.EXPO_PUBLIC_FEATURE_ENV, "production");
assert.equal(production.EXPO_PUBLIC_FEATURE_PROFILE, "production");
assert.equal(production.EXPO_PUBLIC_INTERNAL_FEATURES, "");
assert.equal(production.EAS_BUILD_PROFILE, "local-production");
assert.equal(production.EXPO_NO_DOTENV, "1");
assert.equal(production.SUPABASE_SECRET_KEY, undefined);
assert.equal(production.SUPABASE_ACCESS_TOKEN, undefined);
assert.equal(production.PATH, "/usr/bin");
assert.throws(() => productionClientEnvironment(`
EXPO_PUBLIC_SUPABASE_URL=https://${QA_PROJECT_REF}.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-test
`), /LOCAL APP SAFETY BLOCK/);

console.log("QA client app environment smoke passed");
console.log("Production client app environment smoke passed");
