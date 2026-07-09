const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class OpenAIChatError extends Error {
  constructor(
    message: string,
    readonly code: "missing_api_key" | "api_error",
  ) {
    super(message);
    this.name = "OpenAIChatError";
  }
}

export async function callOpenAI(
  history: OpenAIMessage[],
  systemPrompt: string,
  maxTokens = 300,
): Promise<string> {
  if (!OPENAI_API_KEY.trim()) {
    throw new OpenAIChatError("Missing EXPO_PUBLIC_OPENAI_API_KEY", "missing_api_key");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...history],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new OpenAIChatError(`OpenAI error ${res.status}: ${detail.slice(0, 120)}`, "api_error");
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content.trim();
}
