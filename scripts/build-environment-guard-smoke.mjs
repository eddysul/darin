import assert from "node:assert/strict";
import { validateReleaseEnvironment } from "./lib/release-environment-guard.mjs";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expoConfig = require("../app.config.js");

const base = {
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
};

assert.deepEqual(validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "production",
  EXPO_PUBLIC_FEATURE_PROFILE: "production",
}, "production"), { profile: "production", projectRef: PRODUCTION_PROJECT_REF });

assert.deepEqual(validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${QA_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "qa",
  EXPO_PUBLIC_FEATURE_PROFILE: "internal",
  EXPO_PUBLIC_INTERNAL_FEATURES: "feedingReminder",
}, "qa"), { profile: "qa", projectRef: QA_PROJECT_REF });

assert.throws(() => validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "qa",
  EXPO_PUBLIC_FEATURE_PROFILE: "internal",
}, "qa"), /expected Supabase project/);

assert.throws(() => validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "production",
  EXPO_PUBLIC_FEATURE_PROFILE: "production",
  SUPABASE_SECRET_KEY: "server-secret",
}, "production"), /server-only variables/);

assert.throws(() => validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "production",
  EXPO_PUBLIC_FEATURE_PROFILE: "production",
  EXPO_PUBLIC_INTERNAL_FEATURES: "experimentalNotifications",
}, "production"), /must be empty/);

assert.throws(() => validateReleaseEnvironment({
  ...base,
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_FEATURE_ENV: "production",
  EXPO_PUBLIC_FEATURE_PROFILE: "production",
  EXPO_PUBLIC_SERVICE_ROLE_KEY: "unsafe",
}, "production"), /secret-like EXPO_PUBLIC/);

function withEnv(patch, callback) {
  const previous = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, patch);
    return callback();
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}

withEnv({
  EXPO_PUBLIC_SUPABASE_URL: `https://${QA_PROJECT_REF}.supabase.co`,
}, () => assert.deepEqual(expoConfig({ config: { name: "Darin" } }), { name: "Darin" }));
withEnv({
  EXPO_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
}, () => assert.throws(() => expoConfig({ config: {} }), /local Expo cannot target production/));

console.log("Build environment guard smoke passed");
