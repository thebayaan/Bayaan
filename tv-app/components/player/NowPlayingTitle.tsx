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
        NOW PLAYING · {index + 1} OF {total}
      </Text>
      <Text style={styles.title} numberOfLines={1}>
        {surahName}
      </Text>
      <Text style={styles.reciter} numberOfLines={1}>
        {reciterName}
        {rewayahName ? `  ·  ${rewayahName}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 290,
    gap: 10,
  },
  kicker: {
    color: colors.text,
    ...typography.label,
    opacity: 0.55,
  },
  title: {
    color: colors.text,
    ...typography.titleXL,
    lineHeight: 72,
    letterSpacing: -1,
  },
  reciter: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '500',
    opacity: 0.75,
    marginTop: 2,
  },
});
