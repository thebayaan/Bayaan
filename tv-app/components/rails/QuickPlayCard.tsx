import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';

type Props = {
  surahNumber: number;
  surahName: string;
  onSelect: (n: number) => void;
};

export function QuickPlayCard({
  surahNumber,
  surahName,
  onSelect,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(surahNumber)}
      accessibilityLabel={`Play ${surahName}`}>
      <View style={styles.inner}>
        <Text style={styles.num}>{surahNumber}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {surahName}
        </Text>
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: {width: 170, height: 170, backgroundColor: colors.surface},
  inner: {flex: 1, padding: 18, justifyContent: 'space-between'},
  num: {
    color: colors.text,
    fontSize: 60,
    fontWeight: '200',
    opacity: 0.55,
    letterSpacing: -2,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
