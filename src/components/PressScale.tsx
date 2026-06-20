import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useRef } from "react";

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scale?: number;
  children: React.ReactNode;
};

export function PressScale({ style, scale = 0.96, children, onPress, disabled, ...rest }: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(anim, { toValue: scale, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };

  const onPressOut = () => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  };

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: anim }], opacity: disabled ? 0.45 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
