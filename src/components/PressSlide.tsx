import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
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

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} disabled={disabled} {...rest}>
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
