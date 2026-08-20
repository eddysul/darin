import { STORAGE_KEYS } from "./storageKeys";
import { qaStorage } from "./qaStorage";
import { reportStorageIssue } from "./storageIssues";

const KEY = STORAGE_KEYS.termsAccepted;
const MARKETING_KEY = STORAGE_KEYS.marketingConsent;

/** Opt-in choice plus the moment it was made, so consent stays auditable. */
export type MarketingConsent = { optIn: boolean; decidedAt: string };

let memory: boolean | null = null;
let marketingMemory: MarketingConsent | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function parseMarketingConsent(raw: string | null): MarketingConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MarketingConsent>;
    if (typeof parsed?.optIn !== "boolean") return null;
    return {
      optIn: parsed.optIn,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "",
    };
  } catch {
    return null;
  }
}

export async function hydrateTermsAccepted(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(KEY);
        memory = raw === "1";
      } catch {
        memory = false;
        reportStorageIssue("load", KEY);
      }
      try {
        marketingMemory = parseMarketingConsent(await qaStorage.getItem(MARKETING_KEY));
      } catch {
        marketingMemory = null;
        reportStorageIssue("load", MARKETING_KEY);
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getTermsAccepted(): boolean {
  return memory === true;
}

export async function saveTermsAccepted(accepted: boolean): Promise<void> {
  memory = accepted;
  hydrated = true;
  try {
    if (accepted) await qaStorage.setItem(KEY, "1");
    else await qaStorage.removeItem(KEY);
  } catch {
    reportStorageIssue("save", KEY);
  }
}

export function getMarketingConsent(): MarketingConsent | null {
  return marketingMemory;
}

export async function saveMarketingConsent(optIn: boolean): Promise<void> {
  const consent: MarketingConsent = { optIn, decidedAt: new Date().toISOString() };
  marketingMemory = consent;
  try {
    await qaStorage.setItem(MARKETING_KEY, JSON.stringify(consent));
  } catch {
    reportStorageIssue("save", MARKETING_KEY);
  }
}
