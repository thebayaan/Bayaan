import React, {useRef} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {animateFocusScale, focusScaleDefault} from './focusMotion';
import {FocusedContext} from './focusContext';

export {FocusText, useButtonFocused, useFocusTint} from './focusContext';

type Props = {
  onPress: () => void;
  /** Called when the button gains focus. */
  onFocus?: () => void;
  children: React.ReactNode | ((focused: boolean) => React.ReactNode);
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Extra style while focused, on top of the cream fill. */
  focusedStyle?: StyleProp<ViewStyle>;
  /** Style for the outer (scaling) wrapper, e.g. flex: 1 inside a row. */
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  focusScale?: number;
  /** Draw the hairline outline a screen's main action wears at rest. */
  outlined?: boolean;
};

/**
 * The one button focus treatment (Ink & Cream): nothing behind the content
 * at rest, a cream fill with a soft drop shadow and a slight scale on focus.
 * Children read the focus state through FocusText / useFocusTint (or a render
 * function) so text and icons flip to ink on the cream.
 */
export function FocusableButton({
  onPress,
  onFocus,
  children,
  hasTVPreferredFocus,
  style,
  focusedStyle,
  containerStyle,
  accessibilityLabel,
  focusScale = focusScaleDefault,
  outlined,
}: Props): React.ReactElement {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (): void => {
    setIsFocused(true);
    animateFocusScale(scaleValue, focusScale);
    onFocus?.();
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    animateFocusScale(scaleValue, 1);
  };

  return (
    <Animated.View style={[containerStyle, {transform: [{scale: scaleValue}]}]}>
      <Pressable
        onPress={onPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[
          // Buttons are squircles: a continuous corner curve where the
          // platform draws one (Apple TV), a plain rounded rect elsewhere.
          {borderCurve: 'continuous'},
          outlined && {borderWidth: 2, borderColor: colors.outline},
          style,
          isFocused && {
            backgroundColor: colors.focusFill,
            borderColor: colors.focusFill,
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 16,
            shadowOffset: {width: 0, height: 8},
            elevation: 8,
          },
          isFocused && focusedStyle,
        ]}>
        <FocusedContext.Provider value={isFocused}>
          {typeof children === 'function' ? children(isFocused) : children}
        </FocusedContext.Provider>
      </Pressable>
    </Animated.View>
  );
}
