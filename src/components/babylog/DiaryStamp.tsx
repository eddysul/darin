import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import {
  DIARY_MOOD_OPTIONS,
  DIARY_SKY_OPTIONS,
  getDiaryMoodOption,
  getDiarySkyOption,
  type DiaryMoodId,
  type DiarySkyId,
  type DiaryStampOption,
} from "../../constants/diaryCompose";
import { colors } from "../../theme";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 28, md: 48, lg: 56 };

function StampFace({
  option,
  selected,
  size,
  children,
}: {
  option: DiaryStampOption<string>;
  selected: boolean;
  size: Size;
  children: ReactNode;
}) {
  const dim = SIZE_PX[size];
  const fill = selected ? option.inkStrong : option.ink;
  const rim = selected ? option.rim : `${option.rim}99`;
  const opacity = selected ? 1 : 0.72;

  return (
    <View
      style={[
        styles.face,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: fill,
          borderColor: rim,
          borderWidth: selected ? 2.5 : 1.5,
          opacity,
          transform: selected ? [{ rotate: "-4deg" }] : [{ rotate: "0deg" }],
        },
        selected && styles.faceSelected,
      ]}
    >
      {/* Soft ink blot rings */}
      <View
        pointerEvents="none"
        style={[
          styles.inkRing,
          {
            borderColor: selected ? `${option.rim}55` : `${option.rim}28`,
            borderRadius: dim / 2 - 3,
          },
        ]}
      />
      {children}
    </View>
  );
}

function SkyGlyph({ id, color, size }: { id: DiarySkyId; color: string; size: number }) {
  const s = size;
  switch (id) {
    case "sun":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Circle cx="16" cy="16" r="7" fill={color} />
          <Circle cx="13.5" cy="14.5" r="1.1" fill="#5C4030" />
          <Circle cx="18.5" cy="14.5" r="1.1" fill="#5C4030" />
          <Path d="M13 18.2c1.2 1.4 4.8 1.4 6 0" stroke="#5C4030" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 16 + Math.cos(rad) * 10;
            const y1 = 16 + Math.sin(rad) * 10;
            const x2 = 16 + Math.cos(rad) * 13.2;
            const y2 = 16 + Math.sin(rad) * 13.2;
            return (
              <Path
                key={deg}
                d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      );
    case "cloud":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Ellipse cx="12" cy="18" rx="7" ry="5" fill={color} />
          <Ellipse cx="20" cy="17" rx="8" ry="6" fill={color} />
          <Ellipse cx="16" cy="14" rx="6" ry="5" fill={color} />
        </Svg>
      );
    case "rain":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Ellipse cx="12" cy="13" rx="6" ry="4.5" fill={color} />
          <Ellipse cx="19" cy="12" rx="7" ry="5" fill={color} />
          <Path d="M11 20 l-1.2 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M16 21 l-1.2 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M21 20 l-1.2 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
      );
    case "snow":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path d="M16 6v20M6 16h20M9.5 9.5l13 13M22.5 9.5l-13 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="16" cy="16" r="2.2" fill={color} />
        </Svg>
      );
    case "night":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M20 8c-5.2 0-9.4 4.2-9.4 9.4 0 4.2 2.8 7.8 6.6 9-4.8-.4-8.6-4.4-8.6-9.4C8.6 10.8 13.4 6 19.2 6c.3 0 .5 0 .8.1-0 0 0 1.9 0 1.9z"
            fill={color}
          />
          <Path d="M22 10l.7 1.5L24.2 12l-1.5.7L22 14.2l-.7-1.5L19.8 12l1.5-.7z" fill={color} />
          <Circle cx="25" cy="16" r="1" fill={color} />
        </Svg>
      );
  }
}

function MoodGlyph({ id, color, size }: { id: DiaryMoodId; color: string; size: number }) {
  const s = size;
  switch (id) {
    case "love":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M16 26S6 19.5 6 12.5C6 9 8.8 7 11.5 7c1.8 0 3.3.9 4.5 2.3C17.2 7.9 18.7 7 20.5 7 23.2 7 26 9 26 12.5 26 19.5 16 26 16 26z"
            fill={color}
          />
        </Svg>
      );
    case "proud":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M16 5l2.6 7.2H26l-5.8 4.4 2.2 7.2L16 19.6l-6.4 4.2 2.2-7.2L6 12.2h7.4z"
            fill={color}
          />
        </Svg>
      );
    case "calm":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M16 6c0 8-6 10-6 16 0 3.3 2.7 5 6 5s6-1.7 6-5c0-6-6-8-6-16z"
            fill={color}
          />
          <Path d="M16 14c2-2 5-2.5 6-1" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case "tired":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M21 9c-4.8 0-8.6 3.8-8.6 8.6 0 3.6 2.2 6.7 5.4 8-4.2-.5-7.4-4-7.4-8.4C10.4 11.4 14.8 7 20.4 7c.4 0 .6 0 1 .1 0 0-.4 1.9-.4 1.9z"
            fill={color}
          />
        </Svg>
      );
    case "moved":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path
            d="M16 5C11 11 8 15 8 19.5 8 24 11.5 27 16 27s8-3 8-7.5C24 15 21 11 16 5z"
            fill={color}
            opacity={0.55}
          />
          <Path
            d="M16 22s-4.5-3-4.5-6.2C11.5 14.2 12.8 13 14.2 13c.9 0 1.7.5 2.3 1.2.6-.7 1.4-1.2 2.3-1.2 1.4 0 2.7 1.2 2.7 2.8 0 3.2-4.5 6.2-4.5 6.2z"
            fill={color}
          />
        </Svg>
      );
    case "worry":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Ellipse cx="12" cy="14" rx="5.5" ry="4" fill={color} />
          <Ellipse cx="19" cy="13" rx="6.5" ry="5" fill={color} />
          <Path
            d="M15 21v3.2M15 26.2h.01"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <Circle cx="22" cy="22" r="5.2" fill="none" stroke={color} strokeWidth="1.6" />
          <Path d="M22 19.6v2.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="22" cy="24.2" r="0.7" fill={color} />
        </Svg>
      );
    case "grateful":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Ellipse cx="16" cy="12" rx="3.2" ry="5" fill={color} />
          <Ellipse cx="16" cy="12" rx="5" ry="3.2" fill={color} transform="rotate(45 16 12)" />
          <Ellipse cx="16" cy="12" rx="5" ry="3.2" fill={color} transform="rotate(-45 16 12)" />
          <Circle cx="16" cy="12" r="2" fill="#FFF8EE" />
          <Path d="M16 17v8" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <Path d="M16 22c-3 0-4.5 2-4.5 2" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </Svg>
      );
    case "funny":
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Circle cx="16" cy="16" r="7.5" fill={color} />
          <Circle cx="13" cy="14.2" r="1.2" fill="#5C4030" />
          <Circle cx="19" cy="14.2" r="1.2" fill="#5C4030" />
          <Path d="M12.5 18.5c1.4 2.2 5.6 2.2 7 0" stroke="#5C4030" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {[20, 50, 90, 130, 160, 200, 230, 270, 310, 340].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 16 + Math.cos(rad) * 10.5;
            const y1 = 16 + Math.sin(rad) * 10.5;
            const x2 = 16 + Math.cos(rad) * 13.5;
            const y2 = 16 + Math.sin(rad) * 13.5;
            return (
              <Path
                key={deg}
                d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      );
  }
}

export function DiarySkyStamp({
  id,
  selected = true,
  size = "md",
}: {
  id: string;
  selected?: boolean;
  size?: Size;
}) {
  const option = getDiarySkyOption(id);
  const glyph = SIZE_PX[size] * 0.58;
  return (
    <StampFace option={option} selected={selected} size={size}>
      <SkyGlyph id={option.id} color={option.rim} size={glyph} />
    </StampFace>
  );
}

export function DiaryMoodStamp({
  id,
  selected = true,
  size = "md",
}: {
  id: string;
  selected?: boolean;
  size?: Size;
}) {
  const option = getDiaryMoodOption(id);
  const glyph = SIZE_PX[size] * 0.55;
  return (
    <StampFace option={option} selected={selected} size={size}>
      <MoodGlyph id={option.id} color={option.rim} size={glyph} />
    </StampFace>
  );
}

/** Compact pair for diary list cards — skips null stamps */
export function DiaryStampPair({
  skyId,
  moodId,
  size = "sm",
}: {
  skyId?: string | null;
  moodId?: string | null;
  size?: Size;
}) {
  if (!skyId && !moodId) return null;
  return (
    <View style={styles.pair}>
      {skyId ? <DiarySkyStamp id={skyId} selected size={size} /> : null}
      {moodId ? <DiaryMoodStamp id={moodId} selected size={size} /> : null}
    </View>
  );
}

export function DiarySkyPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: DiarySkyId | null) => void;
}) {
  return (
    <View style={styles.pickerRow}>
      {DIARY_SKY_OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <Pressable
            key={o.id}
            style={styles.pickerItem}
            onPress={() => onChange(active ? null : o.id)}
          >
            <DiarySkyStamp id={o.id} selected={active} size="lg" />
            <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DiaryMoodPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: DiaryMoodId | null) => void;
}) {
  return (
    <View style={styles.moodGrid}>
      {DIARY_MOOD_OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <Pressable
            key={o.id}
            style={styles.moodItem}
            onPress={() => onChange(active ? null : o.id)}
          >
            <DiaryMoodStamp id={o.id} selected={active} size="md" />
            <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  faceSelected: {
    shadowColor: "#8A735A",
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  inkRing: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderWidth: 1,
  },
  pair: { flexDirection: "row", alignItems: "center", gap: 5 },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  pickerItem: { alignItems: "center", flex: 1, gap: 6 },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  moodItem: {
    width: "22%",
    flexGrow: 1,
    maxWidth: "24%",
    alignItems: "center",
    gap: 6,
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.faint,
  },
  pickerLabelActive: {
    color: colors.text,
  },
});
