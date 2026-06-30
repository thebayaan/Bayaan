import React, {useRef} from 'react';
import {Pressable, Animated, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {animateFocusScale, focusScaleDefault} from './focusMotion';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  focusScale?: number;
};

export function FocusableButton({
  onPress,
  children,
  hasTVPreferredFocus,
  style,
  focusedStyle,
  accessibilityLabel,
  focusScale = focusScaleDefault,
}: Props): React.ReactElement {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (): void => {
    setIsFocused(true);
    animateFocusScale(scaleValue, focusScale);
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    animateFocusScale(scaleValue, 1);
  };

  const focusRingStyle = isFocused
    ? {
        borderWidth: 3,
        borderColor: colors.focusRing,
        shadowColor: colors.focusRing,
        shadowOpacity: 0.55,
        shadowRadius: 14,
        shadowOffset: {width: 0, height: 0},
      }
    : {
        borderWidth: 3,
        borderColor: 'transparent',
      };

  return (
    <Animated.View
      style={[
        {
          transform: [{scale: scaleValue}],
        },
        focusedStyle,
      ]}>
      <Pressable
        onPress={onPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[focusRingStyle, style]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
