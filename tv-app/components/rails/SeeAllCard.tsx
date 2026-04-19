import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';

type Props = {onSelect: () => void; height?: number; width?: number};

export function SeeAllCard({
  onSelect,
  height = 280,
  width = 200,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={[styles.card, {height, width}]}
      onPress={onSelect}
      accessibilityLabel="See all reciters">
      <Text style={styles.label}>See all →</Text>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {color: colors.text, ...typography.body, fontWeight: '600'},
});
