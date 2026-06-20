import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

type VoiceWaveformProps = {
  levels: number[];
  barCount?: number;
  height?: number;
  minBarHeight?: number;
  active?: boolean;
};

export function VoiceWaveform({
  levels,
  barCount = 32,
  height = 56,
  minBarHeight = 4,
  active = true,
}: VoiceWaveformProps) {
  const bars = useMemo(() => {
    const slice = levels.slice(-barCount);
    while (slice.length < barCount) slice.unshift(0.08);
    return slice;
  }, [levels, barCount]);

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((level, index) => {
        const normalized = active ? Math.max(minBarHeight / height, Math.min(1, level)) : 0.12;
        return (
          <View
            key={`${index}-${bars.length}`}
            style={[
              styles.bar,
              {
                height: Math.max(minBarHeight, normalized * height),
                opacity: active ? 0.45 + normalized * 0.55 : 0.35,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: "100%",
  },
  bar: {
    flex: 1,
    maxWidth: 6,
    borderRadius: 999,
    backgroundColor: colors.text,
  },
});
