import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TVFocusGuideView,
  View,
} from 'react-native';
import {FocusableButton} from '../primitives/FocusableButton';
import {FocusText} from '../primitives/focusContext';
import {isNetworkError, useTVPlayerStore} from '../../store/tvPlayerStore';
import {colors} from '../../theme/colors';
import {createScaledStyles} from '../../theme/scale';

type Copy = {kicker: string; title: string; body: string};

function copyFor(lastError: string | null): Copy {
  if (isNetworkError(lastError)) {
    return {
      kicker: 'CONNECTION LOST',
      title: "You're offline",
      body: 'Playback needs an internet connection. Check your Wi-Fi and try again.',
    };
  }
  return {
    kicker: 'PLAYBACK ERROR',
    title: 'Could not play this recitation',
    body: lastError ?? 'Something went wrong while loading the audio.',
  };
}

export function ErrorBanner(): React.ReactElement | null {
  const status = useTVPlayerStore(s => s.status);
  const lastError = useTVPlayerStore(s => s.lastError);
  const retry = useTVPlayerStore(s => s.retry);
  const next = useTVPlayerStore(s => s.next);
  // Skip only where there is a next surah to skip to.
  const canSkip = useTVPlayerStore(s => s.currentIndex < s.queue.length - 1);

  const visible = status === 'error' && !!lastError;
  // Try again takes focus when the card shows; asked once mounted too, since
  // hasTVPreferredFocus alone can miss when focus was elsewhere.
  const retryRef = useRef<View>(null);
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => retryRef.current?.requestTVFocus?.(), 0);
    return () => clearTimeout(id);
  }, [visible]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.96,
        stiffness: 220,
        damping: 20,
        mass: 1,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, opacity, scale]);

  if (!visible) return null;

  const copy = copyFor(lastError);

  return (
    <Animated.View style={[styles.wrap, {opacity}]} pointerEvents="box-none">
      <Animated.View style={[styles.card, {transform: [{scale}]}]}>
        <Text style={styles.kicker}>{copy.kicker}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.message} numberOfLines={3}>
          {copy.body}
        </Text>
        <TVFocusGuideView
          style={styles.row}
          autoFocus
          trapFocusUp
          trapFocusDown
          trapFocusLeft
          trapFocusRight>
          <FocusableButton
            ref={retryRef}
            onPress={() => void retry()}
            accessibilityLabel="Retry playback"
            style={styles.cta}
            outlined
            hasTVPreferredFocus>
            <FocusText style={styles.ctaText}>Try again</FocusText>
          </FocusableButton>
          {canSkip && (
            <FocusableButton
              onPress={() => void next()}
              accessibilityLabel="Skip to next track"
              style={styles.ctaSecondary}>
              <FocusText style={styles.ctaText}>Skip</FocusText>
            </FocusableButton>
          )}
        </TVFocusGuideView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = createScaledStyles({
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
    maxWidth: 560,
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
    marginTop: 4,
    opacity: 0.9,
  },
  row: {flexDirection: 'row', gap: 10, marginTop: 4},
  cta: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
  },
  ctaSecondary: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
  },
});
