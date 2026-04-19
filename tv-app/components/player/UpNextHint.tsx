import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

export function UpNextHint(): React.ReactElement | null {
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const shuffle = useTVPlayerStore(s => s.shuffle);
  const repeat = useTVPlayerStore(s => s.repeat);

  if (queue.length <= 1) return null;
  if (shuffle) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.kicker}>UP NEXT</Text>
        <Text style={styles.title} numberOfLines={1}>
          Shuffled from this rewayah
        </Text>
      </View>
    );
  }

  const atLast = currentIndex === queue.length - 1;
  if (atLast && repeat !== 'all') return null;

  const nextIndex = atLast ? 0 : currentIndex + 1;
  const next = queue[nextIndex];
  if (!next) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>UP NEXT</Text>
      <Text style={styles.title} numberOfLines={1}>
        {next.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    top: spacing.xl,
    gap: 4,
  },
  kicker: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    opacity: 0.55,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.9,
    letterSpacing: -0.2,
  },
});
