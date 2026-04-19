import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  focusScale?: number;
};

export function FocusableCard({
  onPress,
  onLongPress,
  children,
  hasTVPreferredFocus,
  style,
  accessibilityLabel,
  focusScale = 1.08,
}: Props): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function animate(to: number): void {
    Animated.spring(scale, {
      toValue: to,
      stiffness: 240,
      damping: 18,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onFocus={() => {
          setFocused(true);
          animate(focusScale);
        }}
        onBlur={() => {
          setFocused(false);
          animate(1);
        }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            borderRadius: 12,
            borderWidth: 4,
            borderColor: 'transparent',
            overflow: 'hidden',
          },
          focused && {
            borderColor: colors.focusRing,
            shadowColor: colors.focusRing,
            shadowOpacity: 0.6,
            shadowRadius: 18,
            shadowOffset: {width: 0, height: 0},
          },
          style,
        ]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
