import {
  QUICK_RECORD_ACTIONS,
  type OneTouchAction,
} from "../constants/quickRecordActions";
import type { RelationshipToChild } from "./careSetup";
import type { AppLanguagePreference } from "./profilePreferences";

export type VolumeUnit = "ml" | "oz";
export type WeightUnit = "kg" | "lb";
export type TemperatureUnit = "c" | "f";
export type HeightUnit = "cm" | "inch";
export type MedicationDefaultUnit = "none" | "ml" | "drop" | "방울" | "포" | "정" | "회" | "스푼" | "g" | "mg" | "other";
export type ClockFormat = "12h" | "24h";
export type DayStart = "midnight" | "04:00";
export type WeekStart = "sunday" | "monday";
export type BabyAgeFormat = "days" | "monthsDays" | "weeks";
export type LoginMethod = "apple" | "google" | "kakao" | "email" | "demo";

export type AppSettings = {
  timers: {
    breastfeeding: boolean;
    switchBreastSide: boolean;
    sleep: boolean;
    pump: boolean;
    tummy: boolean;
    restoreAfterRestart: boolean;
    keepScreenAwake: boolean;
  };
  categories: {
    order: OneTouchAction[];
    visible: OneTouchAction[];
    core: OneTouchAction[];
  };
  units: {
    volume: VolumeUnit;
    weight: WeightUnit;
    temperature: TemperatureUnit;
    height: HeightUnit;
    medicationDefaultUnit: MedicationDefaultUnit;
  };
  time: {
    clock: ClockFormat;
    dayStart: DayStart;
    weekStart: WeekStart;
    babyAge: BabyAgeFormat;
  };
  account: {
    email: string;
    loginMethod: LoginMethod;
    language: AppLanguagePreference;
    relationship: RelationshipToChild;
  };
  notifications: {
    feedingEnabled: boolean;
    feedingIntervalMinutes: number;
    sleepEnabled: boolean;
    sleepIntervalMinutes: number;
  };
  growthBook: {
    showDates: boolean;
    showAuthorNames: boolean;
    defaultLayout: 1 | 2 | 3 | 4;
  };
};

export const ALL_ONE_TOUCH_ACTIONS = QUICK_RECORD_ACTIONS.map((action) => action.id);

export const DEFAULT_CORE_ACTIONS: OneTouchAction[] = [
  "breastfeeding",
  "formula",
  "diaper",
  "sleep",
  "pump",
  "storedMilk",
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timers: {
    breastfeeding: true,
    switchBreastSide: true,
    sleep: true,
    pump: true,
    tummy: true,
    restoreAfterRestart: true,
    keepScreenAwake: false,
  },
  categories: {
    order: [...ALL_ONE_TOUCH_ACTIONS],
    visible: [...ALL_ONE_TOUCH_ACTIONS],
    core: [...DEFAULT_CORE_ACTIONS],
  },
  units: {
    volume: "ml",
    weight: "kg",
    temperature: "c",
    height: "cm",
    medicationDefaultUnit: "none",
  },
  time: {
    clock: "12h",
    dayStart: "midnight",
    weekStart: "sunday",
    babyAge: "days",
  },
  account: {
    email: "",
    loginMethod: "demo",
    language: "ko",
    relationship: "mom",
  },
  notifications: {
    feedingEnabled: false,
    feedingIntervalMinutes: 180,
    sleepEnabled: false,
    sleepIntervalMinutes: 120,
  },
  growthBook: {
    showDates: true,
    showAuthorNames: true,
    defaultLayout: 1,
  },
};

function validActions(value: unknown): OneTouchAction[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ALL_ONE_TOUCH_ACTIONS);
  const legacyActionMap: Record<string, OneTouchAction> = {
    bowel: "diaper",
    urine: "diaper",
  };
  return value.filter(
    (item, index, values): item is OneTouchAction =>
      typeof item === "string" &&
      allowed.has(legacyActionMap[item] ?? item) &&
      values.findIndex((candidate) =>
        typeof candidate === "string" && (legacyActionMap[candidate] ?? candidate) === (legacyActionMap[item] ?? item),
      ) === index,
  ).map((item) => legacyActionMap[item] ?? item) as OneTouchAction[];
}

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const categories = value?.categories;
  const order = validActions(categories?.order);
  const visible = validActions(categories?.visible);
  const core = validActions(categories?.core);
  const completeOrder = [
    ...order,
    ...ALL_ONE_TOUCH_ACTIONS.filter((action) => !order.includes(action)),
  ];
  const requestedVisible = visible.length ? visible : [...ALL_ONE_TOUCH_ACTIONS];
  const normalizedVisible = [
    ...requestedVisible,
    ...completeOrder.filter((action) => !requestedVisible.includes(action)),
  ].slice(0, Math.max(6, requestedVisible.length));
  const requestedCore = (core.length ? core : DEFAULT_CORE_ACTIONS).filter((action) =>
    normalizedVisible.includes(action),
  );
  const normalizedCore = [
    ...requestedCore,
    ...completeOrder.filter(
      (action) => normalizedVisible.includes(action) && !requestedCore.includes(action),
    ),
  ].slice(0, 6);

  return {
    ...DEFAULT_APP_SETTINGS,
    ...value,
    timers: { ...DEFAULT_APP_SETTINGS.timers, ...value?.timers },
    categories: {
      order: completeOrder,
      visible: normalizedVisible,
      core: normalizedCore,
    },
    units: { ...DEFAULT_APP_SETTINGS.units, ...value?.units },
    time: { ...DEFAULT_APP_SETTINGS.time, ...value?.time },
    account: { ...DEFAULT_APP_SETTINGS.account, ...value?.account },
    notifications: {
      ...DEFAULT_APP_SETTINGS.notifications,
      ...value?.notifications,
    },
    growthBook: { ...DEFAULT_APP_SETTINGS.growthBook, ...value?.growthBook },
  };
}
