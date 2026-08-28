import type { MessageKey } from "../../i18n";

export type SettingsPage =
  | "account"
  | "timers"
  | "categories"
  | "units"
  | "time"
  | "careAlerts"
  | "growthBook"
  | "billing"
  | "privacy"
  | "terms"
  | "medical"
  | "contact"
  | "dataExport"
  | "retention"
  | "legal";

export const SETTINGS_PAGE_TITLES: Record<SettingsPage, MessageKey> = {
  account: "settings.critical.086",
  timers: "settings.critical.062",
  categories: "settings.critical.058",
  units: "settings.critical.064",
  time: "settings.critical.065",
  careAlerts: "settings.critical.105",
  growthBook: "settings.critical.074",
  billing: "settings.critical.077",
  privacy: "settings.critical.106",
  terms: "settings.critical.107",
  medical: "settings.critical.108",
  contact: "settings.critical.083",
  dataExport: "settings.critical.109",
  retention: "settings.critical.110",
  legal: "settings.critical.081",
};

export const LEGAL_ACCORDION_SECTIONS: Array<{
  title: MessageKey;
  paragraphs: Array<[MessageKey, MessageKey]>;
}> = [
  {
    title: "settings.critical.111",
    paragraphs: [
      ["settings.critical.111", "settings.critical.112"],
      ["settings.critical.113", "settings.critical.114"],
      ["settings.critical.115", "settings.critical.116"],
    ],
  },
  {
    title: "settings.critical.117",
    paragraphs: [
      ["settings.critical.118", "settings.critical.119"],
      ["settings.critical.089", "settings.critical.120"],
      ["settings.critical.121", "settings.critical.122"],
    ],
  },
  {
    title: "settings.critical.123",
    paragraphs: [
      ["settings.critical.124", "settings.critical.125"],
      ["settings.critical.126", "settings.critical.127"],
    ],
  },
  {
    title: "settings.critical.128",
    paragraphs: [
      ["settings.critical.129", "settings.critical.130"],
      ["settings.critical.131", "settings.critical.132"],
    ],
  },
  {
    title: "settings.critical.133",
    paragraphs: [["settings.critical.134", "settings.critical.135"]],
  },
  {
    title: "settings.critical.106",
    paragraphs: [
      ["settings.critical.136", "settings.critical.137"],
      ["settings.critical.138", "settings.critical.139"],
      ["settings.critical.140", "settings.critical.141"],
      ["settings.critical.142", "settings.critical.143"],
      ["settings.critical.144", "settings.critical.145"],
      ["settings.critical.146", "settings.critical.147"],
      ["settings.critical.115", "settings.critical.148"],
      ["settings.critical.149", "settings.critical.150"],
    ],
  },
  {
    title: "settings.critical.151",
    paragraphs: [
      ["settings.critical.136", "settings.critical.152"],
      ["settings.critical.153", "settings.critical.154"],
      ["settings.critical.155", "settings.critical.156"],
      ["settings.critical.157", "settings.critical.158"],
      ["settings.critical.318", "settings.critical.159"],
      ["settings.critical.160", "settings.critical.161"],
      ["settings.critical.054", "settings.critical.162"],
      ["settings.critical.115", "settings.critical.163"],
      ["settings.critical.164", "settings.critical.165"],
    ],
  },
  {
    title: "settings.critical.319",
    paragraphs: [
      ["settings.critical.136", "settings.critical.166"],
      ["settings.critical.167", "settings.critical.168"],
      ["settings.critical.169", "settings.critical.170"],
      ["settings.critical.171", "settings.critical.172"],
      ["settings.critical.173", "settings.critical.174"],
    ],
  },
];

