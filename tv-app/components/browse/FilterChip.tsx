import React from 'react';
import {View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusText} from '../primitives/focusContext';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A smaller chip, for secondary rows (juz numbers, sort). */
  small?: boolean;
  accessibilityLabel?: string;
  hasTVPreferredFocus?: boolean;
  /** The chip's focusable view, for a focus guide's destinations. */
  chipRef?: React.Ref<View>;
};

/**
 * A filter chip or text tab (Ink & Cream): unfilled at rest, the selected one
 * in cream with a sky underline, and a cream fill with ink text on focus, so
 * "selected" and "focused" never look alike.
 */
export function FilterChip({
  label,
  selected,
  onPress,
  small,
  accessibilityLabel,
  hasTVPreferredFocus,
  chipRef,
}: Props): React.ReactElement {
  const name = accessibilityLabel ?? label;
  return (
    <FocusableButton
      ref={chipRef}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={selected ? `${name}, selected` : name}
      style={[styles.chip, small && styles.chipSmall]}>
      {focused => (
        <>
          <FocusText
            numberOfLines={1}
            style={[styles.text, small && styles.textSmall]}
            color={selected ? colors.text : colors.textSecondary}>
            {label}
          </FocusText>
          <View style={[styles.line, selected && !focused && styles.lineOn]} />
        </>
      )}
    </FocusableButton>
  );
}

const styles = createScaledStyles({
  chip: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  chipSmall: {paddingHorizontal: 14, paddingTop: 7, paddingBottom: 4},
  text: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    fontWeight: '600',
  },
  textSmall: {fontSize: 18},
  line: {
    marginTop: 6,
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  lineOn: {backgroundColor: colors.accent},
});
