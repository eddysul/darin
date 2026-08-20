import type { MiscIconKey } from "../babylog/BabyLogIcon";
import type { MemoryCard } from "../../types/memory";

export const EXAMPLE_FEED_ADS_ENABLED = false;
const INSERT_EVERY = 3;

export type MemoryFeedAd = {
  id: string;
  advertiser: string;
  icon: MiscIconKey;
  categoryLabel: string;
  headline: string;
  body: string;
  ctaLabel: string;
};

export type MemoryFeedRow =
  | { kind: "memory"; card: MemoryCard }
  | { kind: "ad"; ad: MemoryFeedAd };

export const EXAMPLE_MEMORY_FEED_ADS: MemoryFeedAd[] = [
  {
    id: "example-lotion",
    advertiser: "포근하루",
    icon: "sparkles",
    categoryLabel: "보습 · 예시",
    headline: "낮잠 후 보습, 하루 한 번이면 충분해요",
    body: "연한 향과 가벼운 제형으로 얼굴·몸 어디에나. 나중에 이런 육아 브랜드가 이 자리에 들어와요.",
    ctaLabel: "자세히 보기",
  },
  {
    id: "example-album",
    advertiser: "한장앨범",
    icon: "image",
    categoryLabel: "앨범 · 예시",
    headline: "올해의 순간을 한 권으로 남겨보세요",
    body: "추억 사진으로 만드는 성장 앨범 자리입니다. 지금은 광고가 들어오는 위치를 보여 주는 예시예요.",
    ctaLabel: "앨범 살펴보기",
  },
];

export function interleaveExampleFeedAds(
  cards: MemoryCard[],
  hiddenAdIds: ReadonlySet<string>,
): MemoryFeedRow[] {
  if (!EXAMPLE_FEED_ADS_ENABLED || cards.length === 0) {
    return cards.map((card) => ({ kind: "memory" as const, card }));
  }

  const ads = EXAMPLE_MEMORY_FEED_ADS.filter((ad) => !hiddenAdIds.has(ad.id));
  const rows: MemoryFeedRow[] = [];
  let adIndex = 0;

  cards.forEach((card, index) => {
    rows.push({ kind: "memory", card });
    const atInterval = (index + 1) % INSERT_EVERY === 0;
    const afterShortFeed = cards.length < INSERT_EVERY && index === cards.length - 1;
    if ((atInterval || afterShortFeed) && adIndex < ads.length) {
      rows.push({ kind: "ad", ad: ads[adIndex] });
      adIndex += 1;
    }
  });

  return rows;
}
