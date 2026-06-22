/**
 * Verifies AI chat system prompt includes demo event log and OpenAI answers from it.
 * Usage: node scripts/verify-ai-event-context.mjs
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

const DEMO_EVENTS = JSON.parse(
  fs.readFileSync(path.join(root, "src/demo/daily-events.json"), "utf8"),
);

function getRecentEventData(store = {}) {
  const merged = { ...DEMO_EVENTS, ...store };
  const sortedDates = Object.keys(merged).sort().reverse().slice(0, 7);
  return sortedDates
    .map((date) => {
      const events = merged[date]?.events ?? [];
      if (events.length === 0) return null;
      const lines = events
        .filter((e) => e.category)
        .map((e) => {
          const rest = Object.entries(e)
            .filter(([k]) => k !== "category")
            .map(([k, v]) => `${k}: ${String(v ?? "")}`)
            .join(", ");
          return `  - ${e.category}${rest ? ` (${rest})` : ""}`;
        })
        .join("\n");
      return `[${date}]\n${lines}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildSystemPrompt(eventData) {
  return `You are Darin AI, a friendly childcare advisor built into the Darin app.
You help parents understand their child's daily care reports and give practical childcare advice.
Keep responses concise (2-4 sentences). Always respond in Korean (한국어로만 답변하세요).

You have access to the child's recent care event log (last 7 days):
${eventData}

Use this data to give personalized, specific advice based on the child's actual patterns.`;
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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

const eventData = getRecentEventData();
const dates = Object.keys(DEMO_EVENTS).sort().reverse().slice(0, 7);
console.log("=== Event context check ===");
console.log(`Dates in prompt (last 7): ${dates.join(", ")}`);
console.log(`Prompt length: ${eventData.length} chars`);
console.log(`2026-06-20 includes 단호박죽: ${eventData.includes("단호박죽")}`);
console.log(`2026-06-20 includes 오전 낮잠 55min: ${eventData.includes("duration_min: 55") && eventData.includes("오전 낮잠")}`);

const apiKey = loadEnvKey();
if (!apiKey) {
  console.log("\nSkipping live OpenAI test (no OPENAI_API_KEY in .env)");
  process.exit(0);
}

const systemPrompt = buildSystemPrompt(eventData);
const questions = [
  "2026년 6월 20일 오전 낮잠은 몇 분이었나요? 숫자만 간단히 알려주세요.",
  "6월 20일 아침 이유식 메뉴가 뭐였나요?",
  "6월 19일 진료는 어디서 받았나요?",
];

console.log("\n=== Live OpenAI answers ===");
for (const q of questions) {
  const answer = await askOpenAI(apiKey, systemPrompt, q);
  console.log(`\nQ: ${q}`);
  console.log(`A: ${answer}`);
}

const checks = [
  { q: questions[0], expect: /55/ },
  { q: questions[1], expect: /단호박/ },
  { q: questions[2], expect: /우리소아과/ },
];

let passed = 0;
for (let i = 0; i < checks.length; i++) {
  const answer = await askOpenAI(apiKey, systemPrompt, checks[i].q);
  if (checks[i].expect.test(answer)) passed += 1;
}

console.log(`\n=== Result: ${passed}/${checks.length} answers matched expected event data ===`);
process.exit(passed === checks.length ? 0 : 1);
