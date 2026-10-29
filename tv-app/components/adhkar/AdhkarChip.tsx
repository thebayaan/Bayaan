import React, {forwardRef, useRef, useState} from 'react';
import {Animated, Pressable, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';
import {animateFocusScale, focusScaleDefault} from '../primitives/focusMotion';

type Props = {
  label: string;
  /** Small count after the label, e.g. "All 29". */
  count?: number;
  selected: boolean;
  /** Chips pick their group as focus lands on them, like tabs. */
  onSelect: () => void;
  /** OK on the chip; picks the group when not given. */
  onPress?: () => void;
  hasTVPreferredFocus?: boolean;
};

/**
 * A filter chip in the Ink & Cream treatment: muted text at rest, cream text
 * with a sky underline when selected, a cream fill with ink text on focus.
 */
export const AdhkarChip = forwardRef<View, Props>(function AdhkarChip(
  {label, count, selected, onSelect, onPress, hasTVPreferredFocus},
  ref,
): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const tint = focused
    ? colors.onFocus
    : selected
      ? colors.text
      : colors.textSecondary;
  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable
        ref={ref}
        onPress={onPress ?? onSelect}
        onFocus={() => {
          setFocused(true);
          animateFocusScale(scale, focusScaleDefault);
          onSelect();
        }}
        onBlur={() => {
          setFocused(false);
          animateFocusScale(scale, 1);
        }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityRole="button"
        accessibilityState={{selected}}
        accessibilityLabel={count === undefined ? label : `${label} ${count}`}
        style={[styles.chip, focused && styles.chipFocused]}>
        <Text style={[styles.label, {color: tint}]}>
          {label}
          {count === undefined ? null : (
            <Text style={styles.count}>{`  ${count}`}</Text>
          )}
        </Text>
        <View
          style={[
            styles.underline,
            {
              backgroundColor:
                selected && !focused ? colors.accent : 'transparent',
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
});

const styles = createScaledStyles({
  chip: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  chipFocused: {
    backgroundColor: colors.focusFill,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 24,
  },
  count: {fontFamily: fonts.semiBold, fontWeight: '600', opacity: 0.7},
  underline: {
    marginTop: 6,
    height: 3,
    width: 28,
    borderRadius: 2,
  },
});
