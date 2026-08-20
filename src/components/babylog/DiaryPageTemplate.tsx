import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { diaryPageTemplate, type DiaryPageTemplateId } from "../../constants/diaryPageTemplates";
import type { DiarySkyId } from "../../constants/diaryCompose";
import { DiarySkyStamp } from "./DiaryStamp";
import { DiaryTemplateDecoration, DiaryTemplatePattern } from "./DiaryCoverTemplate";

type Props = {
  styleId?: DiaryPageTemplateId | null;
  dateLabel?: string | null;
  weatherStamp?: DiarySkyId | null;
  title?: string | null;
  body?: string | null;
  comments?: Array<{ id: string; author: string; text: string }>;
  compact?: boolean;
  style?: ViewStyle;
};

const BODY_LINE_HEIGHT = 24;
const COMMENT_LINE_HEIGHT = 20;

export function DiaryPageTemplate({ styleId, dateLabel, weatherStamp, title, body, comments = [], compact = false, style }: Props) {
  const template = diaryPageTemplate(styleId);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };
  return (
    <View style={[styles.root, compact ? styles.compact : styles.full, { backgroundColor: template.backgroundColor, borderColor: template.borderColor }, style]}>
      <DiaryTemplatePattern pattern={template.pattern ?? "none"} color={template.borderColor} />
      <View
        onLayout={onLayout}
        style={[styles.surface, { backgroundColor: template.surfaceColor, borderColor: template.borderColor }]}
      >
        {size.width > 0
          ? template.decorations.map((decoration, index) => (
              <DiaryTemplateDecoration
                key={`${decoration.type}-${index}`}
                {...decoration}
                color={template.accentColor}
                width={size.width}
                height={size.height}
                opacity={0.38}
              />
            ))
          : null}
        <View style={styles.foreground}>
        <View style={[styles.header, template.headerStyle !== "line" && styles.roundedHeader, { borderColor: template.accentColor, backgroundColor: template.headerStyle === "line" ? "transparent" : `${template.accentColor}12` }]}>
          <Text style={[styles.date, compact && styles.compactDate, { color: template.textColor }]} numberOfLines={1}>{dateLabel || "년 · 월 · 일"}</Text>
          {weatherStamp ? <DiarySkyStamp id={weatherStamp} selected size={compact ? "sm" : "md"} /> : <View style={[styles.stampPlaceholder, { borderColor: `${template.accentColor}77` }]} />}
        </View>

        <RuledTextArea
          text={body}
          emptyText="오늘의 이야기를 적어보세요"
          color={template.textColor}
          lineColor={`${template.accentColor}55`}
          lineStyle={template.writingLineStyle}
          lineHeight={compact ? 10 : BODY_LINE_HEIGHT}
          lineCount={compact ? 9 : 8}
          compact={compact}
        />

        <View style={[styles.titleSection, template.titleSectionStyle === "box" && { borderWidth: 1, borderColor: `${template.accentColor}66`, borderRadius: 8, backgroundColor: `${template.accentColor}0A` }]}>
          <Text style={[styles.titleLabel, compact && styles.compactLabel, { color: template.accentColor }]}>제목</Text>
          <Text style={[styles.title, compact && styles.compactTitle, { color: template.textColor, borderBottomColor: `${template.accentColor}66` }]} numberOfLines={2} ellipsizeMode="tail">{title?.trim() || "제목을 입력해 주세요"}</Text>
        </View>

        {comments.length > 0 ? (
          <View style={styles.comments}>
            {comments.slice(0, compact ? 1 : 3).map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                <Text style={[styles.commentAuthor, compact && styles.compactLabel, { color: template.accentColor }]} numberOfLines={1}>{comment.author}</Text>
                <RuledTextArea text={comment.text} color={template.textColor} lineColor={`${template.accentColor}44`} lineStyle={template.writingLineStyle} lineHeight={compact ? 9 : COMMENT_LINE_HEIGHT} lineCount={compact ? 1 : 2} compact={compact} />
              </View>
            ))}
          </View>
        ) : null}
        </View>
      </View>
    </View>
  );
}

export function DiaryRuledText({
  text,
  emptyText,
  color,
  lineColor,
  lineStyle,
  lineHeight,
  minLines,
  maxLines,
  fontSize,
  compact = false,
  endGutter = 0,
}: {
  text?: string | null;
  emptyText?: string;
  color: string;
  lineColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineHeight: number;
  minLines: number;
  maxLines?: number;
  fontSize?: number;
  compact?: boolean;
  endGutter?: number;
}) {
  const content = text?.trim() ?? "";
  const [wrapped, setWrapped] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);
  const cap = maxLines ?? minLines;
  const typeSize = fontSize ?? (compact ? 5 : 14);
  const lineCount = Math.min(cap, Math.max(minLines, content ? wrapped || minLines : minLines));
  const ruleTop = Math.min(lineHeight - 1, typeSize + Math.max(1, (lineHeight - typeSize) * 0.12));
  return (
    <View
      style={[styles.ruledArea, { minHeight: lineHeight * lineCount }]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setBoxWidth((prev) => (prev === next ? prev : next));
      }}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {Array.from({ length: lineCount }, (_, index) => (
          <View key={index} style={{ height: lineHeight, width: "100%" }}>
            <View style={[styles.ruledMark, { top: ruleTop }]}>
              <RuledStroke color={lineColor} lineStyle={lineStyle} width={boxWidth} />
            </View>
          </View>
        ))}
      </View>
      <Text
        style={[
          styles.ruledText,
          compact && styles.compactBody,
          {
            color,
            lineHeight,
            fontSize: typeSize,
            includeFontPadding: false,
            paddingRight: endGutter,
          },
        ]}
        numberOfLines={cap}
        onTextLayout={(event) => {
          const next = event.nativeEvent.lines.length;
          setWrapped((prev) => (prev === next ? prev : next));
        }}
      >
        {content || emptyText || ""}
      </Text>
    </View>
  );
}

function RuledTextArea({
  text,
  emptyText,
  color,
  lineColor,
  lineStyle,
  lineHeight,
  lineCount,
  compact,
}: {
  text?: string | null;
  emptyText?: string;
  color: string;
  lineColor: string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineHeight: number;
  lineCount: number;
  compact: boolean;
}) {
  return (
    <DiaryRuledText
      text={text}
      emptyText={emptyText}
      color={color}
      lineColor={lineColor}
      lineStyle={lineStyle}
      lineHeight={lineHeight}
      minLines={lineCount}
      maxLines={lineCount}
      compact={compact}
    />
  );
}

/** RN ignores dashed/dotted on a single border, so the rule is a full-width stroke. */
function RuledStroke({ color, lineStyle, width }: { color: string; lineStyle: "solid" | "dashed" | "dotted"; width: number }) {
  if (width <= 0) return null;
  if (lineStyle === "solid") {
    return <View style={[styles.solidRule, { width, backgroundColor: color }]} />;
  }
  const dash = lineStyle === "dotted" ? "2 3" : "6 4";
  return (
    <Svg width={width} height={1}>
      <Line x1={0} y1={0.5} x2={width} y2={0.5} stroke={color} strokeWidth={1} strokeDasharray={dash} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", borderWidth: 1.5 },
  full: { width: "100%", aspectRatio: 0.72, borderRadius: 18, padding: 12 },
  compact: { width: 104, height: 142, borderRadius: 12, padding: 5 },
  surface: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, overflow: "hidden" },
  foreground: { flex: 1, zIndex: 1 },
  header: { minHeight: 42, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, paddingBottom: 5 },
  roundedHeader: { borderWidth: 1, borderRadius: 10, padding: 5, marginBottom: 5 },
  date: { flex: 1, fontSize: 12, fontWeight: "700" },
  compactDate: { fontSize: 5 },
  stampPlaceholder: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  ruledArea: { position: "relative", width: "100%", overflow: "visible", flexShrink: 1 },
  ruledMark: { position: "absolute", left: 0, right: 0 },
  solidRule: { height: StyleSheet.hairlineWidth },
  ruledText: { width: "100%", fontSize: 14, paddingHorizontal: 0 },
  compactBody: { fontSize: 5 },
  titleSection: { minHeight: 56, padding: 7, marginTop: 8 },
  titleLabel: { fontSize: 11, fontWeight: "800", marginBottom: 3 },
  title: { fontSize: 13, lineHeight: 18, fontWeight: "700", paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  compactLabel: { fontSize: 4 },
  compactTitle: { fontSize: 5, lineHeight: 7, paddingBottom: 1 },
  comments: { marginTop: 6, gap: 4 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  commentAuthor: { width: 62, fontSize: 10, lineHeight: COMMENT_LINE_HEIGHT, fontWeight: "800" },
});
