import { assertQaProjectEnvironment } from "./qa-project-guard.mjs";

const { ref } = assertQaProjectEnvironment();
console.log(`QA project guard passed: ref=${ref}`);
