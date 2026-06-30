import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {animateFocusScale, focusScaleDefault} from './focusMotion';

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
  focusScale = focusScaleDefault,
}: Props): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onFocus={() => {
          setFocused(true);
          animateFocusScale(scale, focusScale);
        }}
        onBlur={() => {
          setFocused(false);
          animateFocusScale(scale, 1);
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
