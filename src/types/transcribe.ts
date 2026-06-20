export type CareEvent = {
  category: string;
  [key: string]: string | number | null | undefined;
};

export type TranscribeResult = {
  events: CareEvent[];
  date: string;
  raw_text: string;
};
