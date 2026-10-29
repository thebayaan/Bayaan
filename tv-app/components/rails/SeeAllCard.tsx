import React from 'react';
import {Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {FocusFrame, FocusText} from '../primitives/focusContext';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

type Props = {onSelect: () => void};

/** The end of a reciter row: a hairline circle in the portraits' place. */
export function SeeAllCard({onSelect}: Props): React.ReactElement {
  return (
    <FocusableCard
      ring={false}
      style={styles.card}
      onPress={onSelect}
      accessibilityLabel="See all reciters">
      <FocusFrame radius={91} style={styles.frame}>
        <View style={styles.circle}>
          <Text style={styles.arrow}>→</Text>
        </View>
      </FocusFrame>
      <FocusText
        style={styles.label}
        color={colors.textSecondary}
        focusedColor={colors.text}>
        See all
      </FocusText>
    </FocusableCard>
  );
}

const styles = createScaledStyles({
  card: {width: 200, height: 280, alignItems: 'center', gap: 12},
  frame: {width: 200, height: 200},
  circle: {
    flex: 1,
    borderRadius: 91,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {color: colors.text, fontSize: 44, fontWeight: '300'},
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    fontWeight: '600',
  },
});
