import { spawnSync } from "node:child_process";
import { loadQaClientEnvironment } from "./lib/client-app-environment.mjs";

const args = process.argv.slice(2);
if (!args.length) throw new Error("Usage: run-expo-qa.mjs <expo command...>");

const result = spawnSync("pnpm", ["exec", "expo", ...args], {
  cwd: process.cwd(),
  env: loadQaClientEnvironment(),
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

