import assert from "node:assert/strict";
import { assertQaProjectEnvironment, QA_PROJECT_REF } from "./lib/qa-project-guard.mjs";

const original = { ...process.env };
function withEnv(patch, callback) {
  for (const key of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
  Object.assign(process.env, patch);
  try { callback(); } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
}

withEnv({}, () => assert.throws(() => assertQaProjectEnvironment(), /required/));
withEnv({
  EXPO_PUBLIC_SUPABASE_URL: "https://efipxojpdirvkeyfdfzl.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SECRET_KEY: "secret-test",
}, () => assert.throws(() => assertQaProjectEnvironment(), /production/));
withEnv({
  EXPO_PUBLIC_SUPABASE_URL: `https://${QA_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SECRET_KEY: "secret-test",
}, () => assert.equal(assertQaProjectEnvironment().ref, QA_PROJECT_REF));

console.log("qa-project-guard-smoke: missing env blocked, production blocked, QA allowed");
