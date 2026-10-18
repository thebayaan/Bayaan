import React, {useRef, useState} from 'react';
import {Animated, Pressable, StyleProp, View, ViewStyle} from 'react-native';
import {noteLongPressOrigin} from '../../services/focusReturn';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';
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
  /** Read out as selected (e.g. the reciter or mode already chosen). */
  selected?: boolean;
};

/**
 * Focus for artwork, where a cream fill would hide the picture: a slight
 * scale, a solid cream ring and a lifted shadow. This is the one deliberate
 * exception to the cream-fill rule, and it stays unmistakable next to an
 * outlined button at rest: the ring is solid cream at twice the outline's
 * width (the outline is a half-strength hairline) and only focus lifts.
 * Children can read the focus state through useButtonFocused / FocusText.
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
  selected,
}: Props): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  // A long-press usually opens a menu: it gives focus back here on close.
  const pressable = useRef<View>(null);

  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable
        ref={pressable}
        onPress={onPress}
        onLongPress={
          onLongPress
            ? () => {
                noteLongPressOrigin(pressable);
                onLongPress();
              }
            : undefined
        }
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
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selected === undefined ? undefined : {selected}}
        style={[
          ring && styles.ring,
          ring && focused && styles.ringFocused,
          style,
        ]}>
        <FocusedContext.Provider value={focused}>
          {children}
        </FocusedContext.Provider>
      </Pressable>
    </Animated.View>
  );
}

const styles = createScaledStyles({
  ring: {
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  ringFocused: {
    borderColor: colors.focusRing,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 10},
  },
});
