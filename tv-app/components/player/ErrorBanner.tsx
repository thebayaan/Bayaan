import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';

export function ErrorBanner(): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const lastError = useTVPlayerStore(s => s.lastError);
  const retry = useTVPlayerStore(s => s.retry);

  if (status !== 'error' || !lastError) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>PLAYBACK ERROR</Text>
        <Text style={styles.message} numberOfLines={2}>
          {lastError}
        </Text>
        <FocusableButton
          onPress={() => void retry()}
          accessibilityLabel="Retry playback"
          style={styles.cta}
          hasTVPreferredFocus>
          <Text style={styles.ctaText}>Try again</Text>
        </FocusableButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    paddingHorizontal: 32,
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: colors.surface,
    maxWidth: 520,
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    opacity: 0.6,
  },
  message: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  cta: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.text,
  },
  ctaText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
