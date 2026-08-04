import { Platform } from "react-native";
import type { ContactRequestCategory, ContactRequestRow } from "../types/database";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

export const ContactRequestRepository = {
  async create(input: { email?: string; category: ContactRequestCategory; message: string }): Promise<ContactRequestRow> {
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const message = input.message.trim();
    if (!message) throw new Error("문의 내용을 입력해주세요.");
    if (message.length > 4000) throw new Error("문의 내용은 4,000자 이하로 입력해주세요.");
    const email = input.email?.trim() || user.email || null;
    if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)) {
      throw new Error("답변 받을 이메일을 확인해주세요.");
    }
    const { data, error } = await requireSupabase().from("contact_requests").insert({
      user_id: user.id,
      email,
      category: input.category,
      message,
      device_info: { platform: Platform.OS, version: Platform.Version },
    }).select("*").single();
    if (error) throw error;
    return data;
  },
};
