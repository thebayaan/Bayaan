import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {animateFocusScale, focusScaleDefault} from './focusMotion';
import {FocusedContext} from './focusContext';

type Props = {
  onPress: () => void;
  onLongPress?: () => void;
  /** Called when the card gains focus (e.g. to scroll its row into place). */
  onFocus?: () => void;
  children: React.ReactNode;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  focusScale?: number;
  /**
   * Draw the cream ring around the whole card (artwork cards). Cards whose
   * artwork is only part of them pass false and wrap the artwork in a
   * FocusFrame instead, so the label below stays outside the ring.
   */
  ring?: boolean;
};

/**
 * Focus for artwork, where a cream fill would hide the picture: a slight
 * scale plus a cream ring. Children can read the focus state through
 * useButtonFocused / FocusText.
 */
export function FocusableCard({
  onPress,
  onLongPress,
  onFocus,
  children,
  hasTVPreferredFocus,
  style,
  accessibilityLabel,
  focusScale = focusScaleDefault,
  ring = true,
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
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          animateFocusScale(scale, 1);
        }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={accessibilityLabel}
        style={[
          ring && {
            borderRadius: 14,
            borderWidth: 4,
            borderColor: 'transparent',
            overflow: 'hidden',
          },
          ring &&
            focused && {
              borderColor: colors.focusRing,
              shadowColor: '#000',
              shadowOpacity: 0.55,
              shadowRadius: 18,
              shadowOffset: {width: 0, height: 10},
            },
          style,
        ]}>
        <FocusedContext.Provider value={focused}>
          {children}
        </FocusedContext.Provider>
      </Pressable>
    </Animated.View>
  );
}
