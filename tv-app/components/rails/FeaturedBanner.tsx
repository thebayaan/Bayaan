import React from 'react';
import {Image} from 'expo-image';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableCard} from '../primitives/FocusableCard';
import {colors} from '../../theme/colors';
import type {Reciter} from '../../types/reciter';

type Props = {
  reciter: Reciter;
  onSelect: (r: Reciter) => void;
  hasTVPreferredFocus?: boolean;
};

export function FeaturedBanner({
  reciter,
  onSelect,
  hasTVPreferredFocus,
}: Props): React.ReactElement {
  return (
    <FocusableCard
      style={styles.card}
      onPress={() => onSelect(reciter)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusScale={1.02}
      accessibilityLabel={`Featured: ${reciter.name}`}>
      {reciter.image_url ? (
        <Image
          source={{uri: reciter.image_url}}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackInitial}>
            {reciter.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.scrimBase} />
      <View style={styles.scrimStep1} />
      <View style={styles.scrimStep2} />
      <View style={styles.scrimStep3} />
      <View style={styles.inner}>
        <Text style={styles.kicker}>FEATURED RECITER</Text>
        <Text style={styles.title} numberOfLines={2}>
          {reciter.name}
        </Text>
        {reciter.date ? (
          <Text style={styles.sub} numberOfLines={1}>
            {reciter.date}
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

const styles = StyleSheet.create({
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
  scrimBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  scrimStep1: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  scrimStep2: {
    position: 'absolute',
    left: 0,
    right: '65%',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  scrimStep3: {
    position: 'absolute',
    left: 0,
    right: '78%',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.30)',
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
