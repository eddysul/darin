export type GrowthTrend = "insufficient" | "increase" | "decrease" | "unchanged";

/**
 * Resolves a trend only when two measurements of the same metric exist.
 * Missing values are deliberately not treated as zero so partial history
 * cannot produce an implied increase or decrease.
 */
export function resolveGrowthTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
): GrowthTrend {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "insufficient";
  if ((current as number) > (previous as number)) return "increase";
  if ((current as number) < (previous as number)) return "decrease";
  return "unchanged";
}

export function growthDirection(trend: GrowthTrend): "↗" | "↘" | "→" | "" {
  if (trend === "increase") return "↗";
  if (trend === "decrease") return "↘";
  if (trend === "unchanged") return "→";
  return "";
}

export type GrowthSummaryState =
  | "insufficient"
  | "increase"
  | "decrease"
  | "unchanged"
  | "mixed";

export function resolveGrowthSummaryState(
  trends: readonly GrowthTrend[],
  hasMilestone: boolean,
): GrowthSummaryState {
  const comparable = trends.filter((trend) => trend !== "insufficient");
  if (!comparable.length) return "insufficient";
  if (comparable.every((trend) => trend === "unchanged")) return "unchanged";
  if (comparable.some((trend) => trend === "decrease")) return "decrease";
  if (comparable.every((trend) => trend === "increase") && hasMilestone) return "increase";
  if (comparable.every((trend) => trend === "increase")) return "increase";
  return "mixed";
}
