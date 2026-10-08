import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import type {Reciter} from '../../types/reciter';
import {createScaledStyles} from '../../theme/scale';
import {getReciterArtwork} from '../../services/reciterArtwork';

// Scrim color is the theme background; only its opacity varies per stop.
const SCRIM = colors.background;

type Props = {
  reciter: Reciter;
  onSelect: (r: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

// `reciter.date` is a catalog timestamp, not something to show a viewer, so
// the banner describes the reciter's rewayat instead.
function featuredSubtitle(reciter: Reciter): string {
  const count = reciter.rewayat.length;
  if (count === 0) return '';
  if (count === 1) return reciter.rewayat[0].name;
  return `${count} rewayat`;
}

export function FeaturedBanner({
  reciter,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  const artwork = getReciterArtwork(reciter);
  const subtitle = featuredSubtitle(reciter);
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(reciter)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      accessibilityLabel={`Featured: ${reciter.name}`}>
      {artwork ? (
        <>
          <Image
            source={artwork}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={60}
            cachePolicy="memory-disk"
          />
          <Svg style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="featuredScrim" x1="0" y1="0" x2="1" y2="0">
                <Stop offset={0} stopColor={SCRIM} stopOpacity={0.92} />
                <Stop offset={0.55} stopColor={SCRIM} stopOpacity={0.6} />
                <Stop offset={1} stopColor={SCRIM} stopOpacity={0.35} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#featuredScrim)" />
          </Svg>
          <Image
            source={artwork}
            style={styles.portrait}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </>
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackInitial}>
            {reciter.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.inner}>
        <Text style={styles.kicker}>FEATURED RECITER</Text>
        <Text style={styles.title} numberOfLines={2}>
          {reciter.name}
        </Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.ctaRow}>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Explore</Text>
          </View>
        </View>
      </View>
    </FocusableCard>
  );
}

const styles = createScaledStyles({
  card: {
    width: '100%',
    height: 320,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 80,
  },
  fallbackInitial: {
    color: colors.text,
    fontSize: 260,
    fontWeight: '200',
    opacity: 0.22,
    lineHeight: 260,
  },
  portrait: {
    position: 'absolute',
    right: 48,
    top: 40,
    width: 240,
    height: 240,
    borderRadius: 16,
  },
  inner: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 8,
    maxWidth: '55%',
  },
  kicker: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.4,
    opacity: 0.8,
  },
  title: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 60,
  },
  sub: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 4,
  },
  ctaRow: {flexDirection: 'row', marginTop: 18},
  cta: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: colors.text,
    borderRadius: 24,
  },
  ctaText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
