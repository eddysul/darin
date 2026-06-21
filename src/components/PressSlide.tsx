import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useRef } from "react";

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  slideAmount?: number;
};

// Horizontal slide + fade on press — replaces instant tap feedback.
// Press: slides right + fades. Release: springs back in from left.
export function PressSlide({ style, children, onPress, disabled, slideAmount = 5, ...rest }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: slideAmount, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 0.65, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  // Forward layout props to Pressable so flex/width distribute correctly in parent containers.
  // Without this, flex:1 on the inner Animated.View has no effect because Pressable has no size.
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const pressableLayout: ViewStyle = {};
  if (flat?.flex != null) pressableLayout.flex = flat.flex;
  if (flat?.width != null) pressableLayout.width = flat.width;
  if (flat?.height != null) pressableLayout.height = flat.height;
  if (flat?.alignSelf != null) pressableLayout.alignSelf = flat.alignSelf;
  if (flat?.minWidth != null) pressableLayout.minWidth = flat.minWidth;

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} disabled={disabled} style={pressableLayout} {...rest}>
      <Animated.View
        style={[
          style,
          { transform: [{ translateX }], opacity: disabled ? 0.4 : opacity },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
