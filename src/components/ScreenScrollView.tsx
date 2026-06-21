import type { Ref } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { useTabContentInsets } from "../hooks/useScreenInsets";
import { colors } from "../theme";

type ScreenScrollViewProps = ScrollViewProps & {
  horizontal?: boolean;
  innerRef?: Ref<ScrollView>;
};

/** ScrollView with flex height + safe top/bottom padding for tab screens. */
export function ScreenScrollView({
  style,
  contentContainerStyle,
  horizontal,
  innerRef,
  children,
  ...props
}: ScreenScrollViewProps) {
  const insets = useTabContentInsets();

  return (
    <ScrollView
      ref={innerRef}
      style={[styles.scroll, style]}
      contentContainerStyle={[
        horizontal ? undefined : insets,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={!horizontal}
      horizontal={horizontal}
      nestedScrollEnabled
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
});
