import React, {useRef} from 'react';
import {Pressable, Animated, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {
  onPress: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function FocusableButton({
  onPress,
  children,
  hasTVPreferredFocus,
  style,
  focusedStyle,
  accessibilityLabel,
}: Props) {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(scaleValue, {
      toValue: 1.08,
      useNativeDriver: false,
      speed: 160,
      bounciness: 0,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: false,
      speed: 160,
      bounciness: 0,
    }).start();
  };

  const focusRingStyle = isFocused
    ? {
        borderWidth: 3,
        borderColor: colors.focusRing,
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
