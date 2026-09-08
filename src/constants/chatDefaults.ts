import type { ChatMessage } from "../types/babyLog";
import { AI_PRODUCT_POLICY_VERSION } from "../utils/aiProductPolicy";

export const DEFAULT_CHAT_GREETING: ChatMessage = {
  id: "greet-1",
  role: "ai",
  text: "안녕하세요! 기록된 사실과 최근 변화를 정리해 드릴게요. 의료 판단은 제공하지 않아요.",
  aiPolicyVersion: AI_PRODUCT_POLICY_VERSION,
};
