import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const approvedEmail = process.env.B04C_TEST_PUSH_EMAIL?.trim().toLowerCase() ?? "";
const execute = process.argv.includes("--execute");
if (process.env.SUPABASE_PROJECT_REF?.trim() !== PRODUCTION_PROJECT_REF
    || !process.env.SUPABASE_DB_PASSWORD
    || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(approvedEmail)) {
  throw new Error("Production identity or test recipient guard failed");
}
if (execute && process.env.B04C_TEST_PUSH_CONFIRM !== "SEND_EXACTLY_ONE_PRODUCTION_TEST_PUSH") {
  throw new Error("explicit one-time test Push confirmation missing");
}
const sql = `select p.expo_push_token
from public.push_tokens p
join auth.users u on u.id=p.user_id
where p.disabled_at is null
  and p.installation_secret_hash is not null
  and lower(u.email)=lower('${approvedEmail}')
  and (select count(*) from public.push_tokens where disabled_at is null)=1;`;
const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  encoding: "utf8",
  env: {
    ...process.env,
    PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`,
    PGUSER: "postgres",
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
    PGDATABASE: "postgres",
    PGSSLMODE: "require",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000",
  },
});
if (result.status !== 0) throw new Error(`test Push recipient preflight failed: ${(result.stderr || "").slice(-500)}`);
const tokens = result.stdout.trim().split("\n").filter(Boolean);
if (tokens.length !== 1 || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(tokens[0])) {
  throw new Error("test Push recipient token is not exact");
}
console.log(JSON.stringify({ execute, recipientCount: 1, activeProofBound: true }));
if (!execute) process.exit(0);

// Exactly one provider request. Never print or persist the token or ticket ID.
const response = await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({
    to: tokens[0],
    sound: "default",
    title: "Darin 알림 테스트",
    body: "알림이 정상적으로 연결됐어요.",
  }),
  signal: AbortSignal.timeout(10_000),
});
const payload = await response.json().catch(() => null);
const ticket = payload && typeof payload === "object" && "data" in payload
  ? (Array.isArray(payload.data) ? payload.data[0] : payload.data)
  : null;
const ticketStatus = typeof ticket?.status === "string" ? ticket.status : "missing";
const errorCategory = typeof ticket?.details?.error === "string" ? ticket.details.error : null;
console.log(JSON.stringify({ providerCalls: 1, responseOk: response.ok, httpStatus: response.status,
  ticketStatus, errorCategory }));
if (!response.ok || ticketStatus !== "ok") process.exit(1);
