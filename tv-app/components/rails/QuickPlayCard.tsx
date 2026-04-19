import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';

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
  card: {width: 120, height: 120, backgroundColor: colors.surface},
  inner: {flex: 1, padding: 12, justifyContent: 'space-between'},
  num: {color: colors.text, fontSize: 36, fontWeight: '300', opacity: 0.5},
  name: {color: colors.text, ...typography.caption},
});
