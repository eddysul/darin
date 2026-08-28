import { validateReleaseEnvironment } from "./lib/release-environment-guard.mjs";

try {
  const result = validateReleaseEnvironment();
  console.log(`Build environment guard passed: profile=${result.profile}, project=${result.projectRef}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

