import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';

export function ErrorBanner(): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const lastError = useTVPlayerStore(s => s.lastError);
  const retry = useTVPlayerStore(s => s.retry);
  const next = useTVPlayerStore(s => s.next);
  const queueLen = useTVPlayerStore(s => s.queue.length);

  if (status !== 'error' || !lastError) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.kicker}>PLAYBACK ERROR</Text>
        <Text style={styles.message} numberOfLines={3}>
          {lastError}
        </Text>
        <View style={styles.row}>
          <FocusableButton
            onPress={() => void retry()}
            accessibilityLabel="Retry playback"
            style={styles.cta}
            hasTVPreferredFocus>
            <Text style={styles.ctaText}>Try again</Text>
          </FocusableButton>
          {queueLen > 1 && (
            <FocusableButton
              onPress={() => void next()}
              accessibilityLabel="Skip to next track"
              style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>Skip</Text>
            </FocusableButton>
          )}
        </View>
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
  row: {flexDirection: 'row', gap: 10, marginTop: 4},
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
  ctaSecondary: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ctaSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
