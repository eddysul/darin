import { spawnSync } from "node:child_process";
import { loadProductionClientEnvironment } from "./lib/client-app-environment.mjs";

const args = process.argv.slice(2);
if (!args.length) throw new Error("Usage: run-expo-production.mjs <expo command...>");

const result = spawnSync("pnpm", ["exec", "expo", ...args], {
  cwd: process.cwd(),
  env: loadProductionClientEnvironment(),
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
