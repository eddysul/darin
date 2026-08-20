import type { ImageSource } from "expo-image";

/** Die-cut sticker artwork shared by the sticker studio and the diary/growth-book templates. */
export const STICKER_DECOR_ART = {
  bear: require("../../assets/sticker-templates/decor-bear.png"),
  cloud: require("../../assets/sticker-templates/decor-cloud-cute.png"),
  exclamation: require("../../assets/sticker-templates/decor-exclamation-red.png"),
  heart: require("../../assets/sticker-templates/decor-heart.png"),
  moon: require("../../assets/sticker-templates/decor-moon.png"),
  puff: require("../../assets/sticker-templates/decor-puff.png"),
  question: require("../../assets/sticker-templates/decor-question.png"),
  scribble: require("../../assets/sticker-templates/decor-scribble.png"),
  sleep: require("../../assets/sticker-templates/decor-sleep.png"),
  sparkle: require("../../assets/sticker-templates/decor-sparkle-blue.png"),
  spoon: require("../../assets/sticker-templates/decor-spoon.png"),
  star: require("../../assets/sticker-templates/decor-star.png"),
  tear: require("../../assets/sticker-templates/decor-tear.png"),
  wave: require("../../assets/sticker-templates/decor-wave.png"),
} satisfies Record<string, ImageSource>;

export type StickerDecorArtKey = keyof typeof STICKER_DECOR_ART;
