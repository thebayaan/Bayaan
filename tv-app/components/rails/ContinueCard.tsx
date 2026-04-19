import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import type {ContinueEntry} from '../../services/continueListeningStore';
import type {Reciter} from '../../types/reciter';

type Props = {
  entry: ContinueEntry;
  reciter: Reciter | null;
  surahName: string;
  onSelect: (e: ContinueEntry) => void;
  hasTVPreferredFocus?: boolean;
};

export function ContinueCard({
  entry,
  reciter,
  surahName,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const progress = entry.durationSeconds
    ? Math.min(1, entry.positionSeconds / entry.durationSeconds)
    : 0;

  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(entry)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={`Resume ${surahName} by ${reciter?.name ?? ''}`}>
      {reciter?.image_url ? (
        <Image
          source={{uri: reciter.image_url}}
          style={styles.img}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: colors.surfaceElevated},
          ]}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.scrimBase]} />
      <View style={styles.scrimBottom} />
      <View style={styles.meta}>
        <Text style={styles.kicker}>CONTINUE</Text>
        <Text style={styles.title} numberOfLines={1}>
          {surahName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {reciter?.name ?? ''}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${progress * 100}%`}]} />
        </View>
      </View>
    </FocusableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 200,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  img: {...StyleSheet.absoluteFillObject},
  scrimBase: {backgroundColor: 'rgba(0,0,0,0.25)'},
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  meta: {position: 'absolute', left: 18, right: 18, bottom: 16},
  kicker: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    opacity: 0.75,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sub: {color: colors.text, fontSize: 13, opacity: 0.75, marginTop: 3},
  track: {
    marginTop: 12,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {height: '100%', backgroundColor: colors.text, borderRadius: 3},
});
