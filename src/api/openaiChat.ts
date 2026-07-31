import { TRANSCRIBE_API_URL } from "../config/api";
import { getAIRequestHeaders } from "./aiAuth";

const CHAT_API_URL = `${TRANSCRIBE_API_URL}/chat`;

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
  const authHeaders = await getAIRequestHeaders();
  const res = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      history,
      systemPrompt,
      maxTokens,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new OpenAIChatError(`OpenAI error ${res.status}: ${detail.slice(0, 120)}`, "api_error");
  }

  const data = (await res.json()) as { reply?: string; content?: string };
  const reply = data.reply ?? data.content;
  if (!reply?.trim()) {
    throw new OpenAIChatError("AI server returned an empty response", "api_error");
  }
  return reply.trim();
}
