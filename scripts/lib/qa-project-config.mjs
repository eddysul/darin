import { existsSync, readFileSync } from "node:fs";

const projectRefs = JSON.parse(
  readFileSync(new URL("./project-refs.json", import.meta.url), "utf8"),
);

export const QA_PROJECT_REF = projectRefs.qa;
export const PRODUCTION_PROJECT_REF = projectRefs.production;

export function qaConfirmation(prefix) {
  return `${prefix}_${QA_PROJECT_REF}`;
}

export function assertQaProjectRef(value, label = "target") {
  const normalized = String(value ?? "");
  if (!normalized.includes(QA_PROJECT_REF) || normalized.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(`QA SAFETY BLOCK: ${label} is not the approved QA project`);
  }
}

export function resolvePsqlBinary() {
  const configured = process.env.PSQL_BIN?.trim();
  if (configured) return configured;
  const homebrew = "/opt/homebrew/opt/postgresql@16/bin/psql";
  return existsSync(homebrew) ? homebrew : "psql";
}
