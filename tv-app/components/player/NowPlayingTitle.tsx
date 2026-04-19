// tv-app/components/player/NowPlayingTitle.tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';
import {spacing} from '../../theme/spacing';

type Props = {
  index: number;
  total: number;
  surahName: string;
  reciterName: string;
  rewayahName: string;
};

export function NowPlayingTitle({
  index,
  total,
  surahName,
  reciterName,
  rewayahName,
}: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>
        NOW PLAYING · {index + 1} of {total}
      </Text>
      <Text style={styles.title}>{surahName}</Text>
      <Text style={styles.reciter}>{reciterName}</Text>
      <Text style={styles.rewayah}>{rewayahName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 150,
    gap: 4,
  },
  kicker: {color: colors.textTertiary, ...typography.label},
  title: {color: colors.text, ...typography.titleXL, lineHeight: 64},
  reciter: {color: colors.text, fontSize: 18, opacity: 0.7},
  rewayah: {color: colors.text, fontSize: 14, opacity: 0.45},
});
