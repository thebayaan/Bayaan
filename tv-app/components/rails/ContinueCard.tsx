import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import {typography} from '../../theme/typography';
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
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.meta}>
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
  scrim: {backgroundColor: 'rgba(0,0,0,0.5)'},
  meta: {position: 'absolute', left: 16, right: 16, bottom: 14},
  title: {color: colors.text, fontSize: 18, fontWeight: '700'},
  sub: {color: colors.text, fontSize: 13, opacity: 0.8, marginTop: 3},
  track: {
    marginTop: 10,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
  },
  fill: {height: '100%', backgroundColor: colors.text, borderRadius: 2},
});
