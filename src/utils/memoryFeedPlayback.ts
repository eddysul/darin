export const MEMORY_FEED_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 65,
  minimumViewTime: 180,
};

export function memoryFeedPostIdFromViewable(item: { kind?: string; card?: { post: { id: string } }; post?: { id: string } }): string | null {
  if (item.kind === "ad") return null;
  if (item.kind === "memory" && item.card?.post.id) return item.card.post.id;
  if (item.post?.id) return item.post.id;
  return null;
}
