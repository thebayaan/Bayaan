import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';

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
      <View style={styles.inner}>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.label}>See all</Text>
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inner: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10},
  arrow: {color: colors.text, fontSize: 40, fontWeight: '300', opacity: 0.8},
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
