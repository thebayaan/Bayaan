import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleProp, View, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FocusableCard({
  onPress,
  children,
  hasTVPreferredFocus,
  style,
  accessibilityLabel,
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
        onFocus={() => {
          setFocused(true);
          animate(1.08);
        }}
        onBlur={() => {
          setFocused(false);
          animate(1);
        }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[
          {borderRadius: 12, borderWidth: 3, borderColor: 'transparent'},
          focused && {borderColor: colors.focusRing},
          style,
        ]}>
        <View>{children}</View>
      </Pressable>
    </Animated.View>
  );
}
