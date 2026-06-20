import type { ContractFields } from "../types/interview";
import type { UserProfile } from "../types/profile";

type ContractInput = {
  parent: UserProfile;
  caregiverName: string;
  fields: ContractFields;
  signature: string;
  locale: "en" | "ko";
};

export function buildContractPreview({ parent, caregiverName, fields, signature, locale }: ContractInput): string {
  const ko = locale === "ko";
  const liveIn = fields.liveIn
    ? ko ? "상주 (Live-in)" : "Live-in"
    : ko ? "비상주 (Live-out)" : "Live-out";

  if (ko) {
    return `돌봄 서비스 계약서

본 계약은 다음 당사자 간에 체결됩니다.

• 고용주(부모): ${parent.name}
• 거주지: ${parent.location}
• 돌보미: ${caregiverName}

1. 서비스 시작일: ${fields.startDate || "—"}
2. 주급: ${fields.weeklyPay || "—"}
3. 근무 형태: ${liveIn}
4. 근무 시간: ${fields.workHours || "—"}
5. 특약 사항: ${fields.specialTerms || "없음"}

고용주는 위 조건에 동의하며, Darin 플랫폼을 통해 본 계약을 체결합니다.

서명: ${signature}
날짜: ${new Date().toLocaleDateString("ko-KR")}`;
  }

  return `Care Services Agreement

This agreement is entered into between:

• Employer (Parent): ${parent.name}
• Location: ${parent.location}
• Caregiver: ${caregiverName}

1. Start date: ${fields.startDate || "—"}
2. Weekly rate: ${fields.weeklyPay || "—"}
3. Arrangement: ${liveIn}
4. Work hours: ${fields.workHours || "—"}
5. Special terms: ${fields.specialTerms || "None"}

The employer agrees to the terms above and executes this contract via Darin.

Signature: ${signature}
Date: ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function defaultContractFields(
  profile: UserProfile,
  weeklyPay: string,
): ContractFields {
  return {
    startDate: profile.dueDate ? `After ${profile.dueDate}` : "Aug 20, 2026",
    weeklyPay,
    liveIn: profile.liveIn ?? false,
    workHours: profile.liveIn ? "Live-in · 24/7 on-call" : "Mon–Fri · 8am–6pm",
    specialTerms: profile.notes?.trim() || "",
  };
}
