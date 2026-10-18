import React, {useRef} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';
import {animateFocusScale, focusScaleDefault} from './focusMotion';
import {FocusedContext} from './focusContext';

export {FocusText, useButtonFocused, useFocusTint} from './focusContext';

type Props = {
  onPress: () => void;
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
  /** Read out as selected (a chosen tab, option or chip). */
  selected?: boolean;
  /** Not pressable; read out as dimmed. Focus can still land on it. */
  disabled?: boolean;
};

/**
 * The one button focus treatment (Ink & Cream): nothing behind the content
 * at rest, a cream fill with a soft drop shadow and a slight scale on focus.
 * Children read the focus state through FocusText / useFocusTint (or a render
 * function) so text and icons flip to ink on the cream.
 */
export function FocusableButton({
  onPress,
  children,
  hasTVPreferredFocus,
  style,
  focusedStyle,
  containerStyle,
  accessibilityLabel,
  focusScale = focusScaleDefault,
  outlined,
  selected,
  disabled,
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

  return (
    <Animated.View style={[containerStyle, {transform: [{scale: scaleValue}]}]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onFocus={handleFocus}
        onBlur={handleBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={
          selected === undefined && disabled === undefined
            ? undefined
            : {selected, disabled}
        }
        style={[
          styles.base,
          outlined && styles.outlined,
          style,
          isFocused && styles.focused,
          isFocused && focusedStyle,
        ]}>
        <FocusedContext.Provider value={isFocused}>
          {typeof children === 'function' ? children(isFocused) : children}
        </FocusedContext.Provider>
      </Pressable>
    </Animated.View>
  );
}

const styles = createScaledStyles({
  // Buttons are squircles: a continuous corner curve where the platform
  // draws one (Apple TV), a plain rounded rect elsewhere.
  base: {borderCurve: 'continuous'},
  outlined: {borderWidth: 2, borderColor: colors.outline},
  focused: {
    backgroundColor: colors.focusFill,
    borderColor: colors.focusFill,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
});
