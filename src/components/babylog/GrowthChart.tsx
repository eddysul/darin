/**
 * 성장 곡선 하나. 의사가 보여주는 성장도표와 같은 구성이다.
 *
 * 배경에 WHO 백분위 곡선(3/15/50/85/97)을 깔고 그 위에 아이의 측정값을 얹는다.
 * 숫자 하나만 보면 "이번에 몇 kg"이지만, 곡선 위에 얹으면 "어느 줄을 따라 가고 있나"가 보인다.
 * 부모가 보고 싶은 건 후자다.
 */
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  CURVE_PERCENTILES,
  WHO_MAX_DAYS,
  describePercentile,
  percentileFor,
  valueAtZ,
  zForPercentile,
  type WhoMeasure,
  type WhoSex,
} from "../../utils/growthPercentile";
import { shortDateLabel } from "../../utils/dateKey";
import { colors } from "../../theme";
import { useLanguage } from "../../LanguageContext";

export type GrowthPoint = {
  ageDays: number;
  value: number;
  /** 잰 날. 백분위가 언제 기준인지 배지에 밝히는 데 쓴다. */
  dateKey: string;
};

type Props = {
  measure: WhoMeasure;
  label: string;
  unit: string;
  color: string;
  sex: WhoSex;
  points: GrowthPoint[];
};

const HEIGHT = 210;
const PAD = { top: 12, right: 26, bottom: 22, left: 38 };
const DAYS_PER_MONTH = 30.4375;
/** 곡선을 몇 개의 점으로 그릴지. 더 늘려도 눈에 보이는 차이가 없다. */
const CURVE_STEPS = 48;

/** 아이 나이에 맞춰 가로 범위를 잡는다. 5년 전체를 늘 보여주면 지금이 안 보인다. */
function xDomain(points: GrowthPoint[]): number {
  const newest = points.length ? Math.max(...points.map((p) => p.ageDays)) : 0;
  const padded = newest + DAYS_PER_MONTH * 2;
  return Math.min(WHO_MAX_DAYS, Math.max(padded, DAYS_PER_MONTH * 6));
}

/** 가로 눈금 간격(개월). 범위가 넓어지면 성기게. */
function monthStep(maxDays: number): number {
  const months = maxDays / DAYS_PER_MONTH;
  if (months <= 8) return 1;
  if (months <= 15) return 2;
  if (months <= 30) return 3;
  return 6;
}

export function GrowthChart({ measure, label, unit, color, sex, points }: Props) {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const sorted = [...points].sort((a, b) => a.ageDays - b.ageDays);
  const latest = sorted[sorted.length - 1];
  const percentile = latest ? percentileFor(measure, sex, latest.ageDays, latest.value) : null;

  const maxDays = xDomain(sorted);
  const grid = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => (maxDays * i) / CURVE_STEPS);

  // 백분위별 곡선. 범위를 벗어난 나이는 그리지 않는다.
  const curves = CURVE_PERCENTILES.map((p) => ({
    percentile: p,
    z: zForPercentile(p),
    values: grid.map((day) => valueAtZ(measure, sex, day, zForPercentile(p))),
  }));

  const spread = curves.flatMap((c) => c.values).filter((v): v is number => v !== null);
  const childValues = sorted.map((p) => p.value);
  if (!spread.length) return null;

  const rawMin = Math.min(...spread, ...childValues);
  const rawMax = Math.max(...spread, ...childValues);
  const margin = (rawMax - rawMin) * 0.06 || 1;
  const yMin = rawMin - margin;
  const yMax = rawMax + margin;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (day: number) => PAD.left + (day / maxDays) * plotW;
  const yAt = (value: number) => PAD.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const pathOf = (values: (number | null)[]) =>
    values
      .map((value, i) => (value === null ? "" : `${i === 0 ? "M" : "L"}${xAt(grid[i]).toFixed(1)} ${yAt(value).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  const months = maxDays / DAYS_PER_MONTH;
  const step = monthStep(maxDays);
  const ticks = Array.from({ length: Math.floor(months / step) + 1 }, (_, i) => i * step);
  const yTicks = [yMin + (yMax - yMin) * 0.15, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.85];

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={latest
        ? `${label}: ${latest.value.toFixed(measure === "weight" ? 2 : 1)} ${unit}`
        : `${label}: ${t("growth.critical.160")}`}
    >
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {latest ? (
          <Text style={styles.value}>
            {latest.value.toFixed(measure === "weight" ? 2 : 1)}
            <Text style={styles.unit}> {unit}</Text>
          </Text>
        ) : (
          <Text style={styles.empty}>{t("growth.critical.160")}</Text>
        )}
      </View>

      {percentile !== null ? (
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { color, backgroundColor: `${color}1F` }]}>
            {t("growth.critical.161", { percent: Math.max(1, Math.min(99, Math.round(100 - percentile))) })}
          </Text>
          <Text style={styles.badgeNote}>
            {shortDateLabel(latest.dateKey)} · {describePercentile(percentile)}
          </Text>
        </View>
      ) : null}

      {width > 0 ? (
        <Svg width={width} height={HEIGHT} accessible={false}>
          {/* 3~97 구간을 옅게 채워 "대부분이 여기 있다"를 먼저 보이게 한다. */}
          <Path
            d={`${pathOf(curves[0].values)} ${curves[4].values
              .map((value, i) => (value === null ? "" : `${i === 0 ? "L" : "L"}${xAt(grid[i]).toFixed(1)} ${yAt(value).toFixed(1)}`))
              .filter(Boolean)
              .reverse()
              .join(" ")} Z`}
            fill={colors.cardHi}
            opacity={0.9}
          />

          {yTicks.map((value) => (
            <Line
              key={`y${value}`}
              x1={PAD.left}
              y1={yAt(value)}
              x2={PAD.left + plotW}
              y2={yAt(value)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {yTicks.map((value) => (
            <SvgText
              key={`yl${value}`}
              x={PAD.left - 6}
              y={yAt(value) + 3.5}
              fontSize={9}
              fill={colors.faint}
              textAnchor="end"
            >
              {value.toFixed(measure === "weight" ? 1 : 0)}
            </SvgText>
          ))}

          {curves.map((curve) => (
            <Path
              key={curve.percentile}
              d={pathOf(curve.values)}
              fill="none"
              stroke={curve.percentile === 50 ? colors.faint : colors.border}
              strokeWidth={curve.percentile === 50 ? 1.4 : 1}
              strokeDasharray={curve.percentile === 50 ? undefined : "3 3"}
            />
          ))}
          {curves.map((curve) => {
            const last = curve.values[curve.values.length - 1];
            return last === null ? null : (
              <SvgText
                key={`c${curve.percentile}`}
                x={PAD.left + plotW + 3}
                y={yAt(last) + 3}
                fontSize={8}
                fill={colors.faint}
              >
                {curve.percentile}
              </SvgText>
            );
          })}

          {ticks.map((month) => (
            <SvgText
              key={`x${month}`}
              x={xAt(month * DAYS_PER_MONTH)}
              y={HEIGHT - 6}
              fontSize={9}
              fill={colors.faint}
              textAnchor="middle"
            >
              {month}
            </SvgText>
          ))}

          {sorted.length > 1 ? (
            <Path
              d={sorted
                .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.ageDays).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
          ) : null}
          {sorted.map((p, i) => (
            <Circle
              key={`p${i}`}
              cx={xAt(p.ageDays)}
              cy={yAt(p.value)}
              r={i === sorted.length - 1 ? 4.5 : 2.8}
              fill={color}
              stroke={colors.card}
              strokeWidth={i === sorted.length - 1 ? 2 : 0}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}

      <Text style={styles.axisNote}>{t("growth.critical.162")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  label: { fontSize: 13, fontWeight: "800", color: colors.text },
  value: { fontSize: 20, fontWeight: "900", color: colors.text },
  unit: { fontSize: 11, fontWeight: "700", color: colors.faint },
  empty: { fontSize: 12, fontWeight: "700", color: colors.faint },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  badgeNote: { flex: 1, fontSize: 10.5, color: colors.faint },
  axisNote: { fontSize: 9, color: colors.faint, textAlign: "right", marginTop: -4 },
});
