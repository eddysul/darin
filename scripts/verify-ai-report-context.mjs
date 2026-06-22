/**
 * Verifies AI chat uses extracted daily report data in answers.
 * Usage: node scripts/verify-ai-report-context.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvKey() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return "";
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key === "OPENAI_API_KEY" || key === "EXPO_PUBLIC_OPENAI_API_KEY") {
      return rest.join("=").trim();
    }
  }
  return "";
}

const sampleReport = {
  id: "test-report-1",
  date: "June 20, 2026",
  child: "Emma",
  caregiver: "Ji-yeon Park",
  sourceNote: "Emma had a slight cough after lunch and needs extra clothes tomorrow.",
  careSummaryEn: "Emma had a stable day with a slight cough after lunch noted.",
  careSummaryKo: "Emma는 점심 후 가벼운 기침이 있었던 안정적인 하루를 보냈습니다.",
  reportEn:
    "Emma finished lunch well, napped for one hour, and had a slight cough after lunch. Please pack extra clothes for tomorrow.",
  reportKo:
    "Emma는 점심을 잘 먹고 1시간 낮잠을 잤습니다. 점심 후 가벼운 기침이 있었고, 내일 여벌 옷을 챙겨주세요.",
  parentReplyDraft: "When did the cough start?",
  mainCategories: ["meal", "sleep"],
  details: [
    { type: "meal", value: "Lunch finished well", recorded: true },
    { type: "sleep", value: "Nap about 1 hour", recorded: true },
    { type: "bowel", value: "Normal", recorded: true },
  ],
  items: [
    { type: "health", label: "Health Note", value: "Slight cough after lunch" },
    { type: "reminder", label: "Reminder", value: "Extra clothes needed tomorrow" },
  ],
  savedAt: "5:42 PM",
};

function formatReportForAI(report, isLatest = false) {
  const latestTag = isLatest ? " [LATEST]" : "";
  const lines = [
    `--- Report ${report.date}${latestTag} ---`,
    `Child: ${report.child}`,
    `Caregiver: ${report.caregiver}`,
    `Care summary (EN): ${report.careSummaryEn}`,
    `Full report (EN): ${report.reportEn}`,
    `Full report (KO): ${report.reportKo}`,
    "Structured care details:",
    ...report.details.filter((d) => d.recorded).map((d) => `  • ${d.type}: ${d.value}`),
    "Care highlights:",
    ...report.items.map((i) => `  • ${i.label}: ${i.value}`),
    `Caregiver source note: ${report.sourceNote}`,
  ];
  return lines.join("\n");
}

function buildSystemPrompt(reportBlock) {
  return `You are Darin AI. Always respond in Korean.
You have the child's saved daily care reports. The first report is the most recent:

${reportBlock}

Base answers on these facts only.`;
}

async function askOpenAI(apiKey, systemPrompt, question) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

const reportBlock = formatReportForAI(sampleReport, true);
console.log("=== Report context includes cough + extra clothes ===");
console.log(reportBlock.includes("cough"));
console.log(reportBlock.includes("extra clothes"));

const apiKey = loadEnvKey();
if (!apiKey) {
  console.log("\nSkipping live OpenAI test (no API key)");
  process.exit(0);
}

const systemPrompt = buildSystemPrompt(reportBlock);
const q1 = "오늘 기침은 언제부터 있었나요?";
const q2 = "내일 챙겨야 할 것이 있나요?";
const a1 = await askOpenAI(apiKey, systemPrompt, q1);
const a2 = await askOpenAI(apiKey, systemPrompt, q2);
console.log(`\nQ: ${q1}\nA: ${a1}`);
console.log(`\nQ: ${q2}\nA: ${a2}`);

const ok = /기침|cough|점심|lunch/i.test(a1) && /옷|clothes|여벌/i.test(a2);
console.log(`\n=== Result: ${ok ? "PASS" : "FAIL"} ===`);
process.exit(ok ? 0 : 1);
