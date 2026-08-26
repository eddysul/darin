import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const listed = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
);
if (listed.status !== 0) throw new Error(listed.stderr || "git ls-files failed");

const patterns = [
  { name: "OpenAI key", value: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: "Supabase secret key", value: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", value: /\bgh[opusr]_[A-Za-z0-9]{30,}\b/g },
  { name: "private key", value: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "assigned server secret",
    value: /(?:SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY|CARE_REMINDER_CRON_SECRET)\s*=\s*["']?(?!$|your_|example|placeholder)[^\s"']{12,}/gim,
  },
];

const findings = [];
for (const file of listed.stdout.split("\0").filter(Boolean)) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > 1_000_000) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue;
  for (const pattern of patterns) {
    pattern.value.lastIndex = 0;
    if (pattern.value.test(text)) findings.push(`${file}: ${pattern.name}`);
  }
}

if (findings.length) {
  console.error("Secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Secret scan passed: tracked and untracked non-ignored files contain no recognized plaintext secrets");
