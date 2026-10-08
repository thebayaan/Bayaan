import React, {useCallback} from 'react';
import {StyleSheet, Text, View, useTVEventHandler} from 'react-native';
import type {HWEvent} from 'react-native';
import {ArtworkBackdrop} from '../components/player/ArtworkBackdrop';
import {ArtworkCard} from '../components/player/ArtworkCard';
import {ErrorBanner} from '../components/player/ErrorBanner';
import {NowPlayingTitle} from '../components/player/NowPlayingTitle';
import {Scrubber} from '../components/player/Scrubber';
import {TransportRow} from '../components/player/TransportRow';
import {UpNextHint} from '../components/player/UpNextHint';
import {SecondaryOverlay} from '../components/player/SecondaryOverlay';
import {SpeedOverlay} from '../components/player/SpeedOverlay';
import {SleepTimerOverlay} from '../components/player/SleepTimerOverlay';
import {AmbientOverlay} from '../components/player/AmbientOverlay';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {useNavStore} from '../store/navStore';
import {useReciters} from '../hooks/useReciters';
import type {Rewayah} from '../types/reciter';
import {colors} from '../theme/colors';
import {fonts, typography} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles} from '../theme/scale';
import {getReciterArtwork} from '../services/reciterArtwork';

const SEEK_STEP_SECONDS = 15;

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function rewayahLabel(rewayah: Rewayah | null): string {
  if (!rewayah) return '';
  const style = rewayah.style.trim();
  if (style.length === 0) return rewayah.name;
  if (rewayah.name.length === 0) return capitalize(style);
  return `${rewayah.name} · ${capitalize(style)}`;
}

export function NowPlayingScreen(): React.ReactElement {
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const toggle = useTVPlayerStore(s => s.toggle);
  const seekBy = useTVPlayerStore(s => s.seekBy);
  const resetNav = useNavStore(s => s.reset);
  const pop = useNavStore(s => s.pop);
  const {reciters} = useReciters();

  const item = queue[currentIndex];
  const reciter = item
    ? reciters.find(r => r.id === item.reciterId) ?? null
    : null;
  const rewayah =
    item && reciter
      ? reciter.rewayat.find(rw => rw.id === item.rewayahId) ?? null
      : null;

  // Hardware remote shortcuts that should work regardless of which transport
  // button currently holds focus. Swipe gestures map to the ±15s seek; the
  // dedicated play/pause key toggles playback. Directional clicks are left to
  // the focus engine so left/right still navigates between transport buttons.
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      switch (event.eventType) {
        case 'playPause':
          toggle();
          return;
        case 'swipeRight':
          seekBy(SEEK_STEP_SECONDS);
          return;
        case 'swipeLeft':
          seekBy(-SEEK_STEP_SECONDS);
          return;
        default:
          return;
      }
    },
    [toggle, seekBy],
  );

  useTVEventHandler(handleTVEvent);

  if (!item) {
    return (
      <View style={styles.container}>
        <ArtworkBackdrop artwork={null} />
        <View style={styles.empty}>
          <Text style={styles.emptyKicker}>NOTHING PLAYING</Text>
          <Text style={styles.emptyTitle}>Choose a reciter to begin</Text>
          <Text style={styles.emptyBody}>
            Browse the catalog and pick a surah to start listening.
          </Text>
          <FocusableButton
            onPress={resetNav}
            accessibilityLabel="Browse reciters"
            style={styles.emptyCta}
            hasTVPreferredFocus>
            <Text style={styles.emptyCtaText}>Browse reciters</Text>
          </FocusableButton>
        </View>
      </View>
    );
  }

  const reciterName = reciter?.name ?? item.subtitle;
  const artwork = getReciterArtwork(reciter);

  return (
    <View style={styles.container}>
      <ArtworkBackdrop artwork={artwork} />
      <FocusableButton
        onPress={pop}
        accessibilityLabel="Back"
        style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </FocusableButton>
      <UpNextHint />
      <ArtworkCard artwork={artwork} reciterName={reciterName} />
      <NowPlayingTitle
        index={currentIndex}
        total={queue.length}
        surahName={item.title}
        reciterName={reciterName}
        rewayahName={rewayahLabel(rewayah)}
      />
      <Scrubber />
      <TransportRow />
      <ErrorBanner />
      <SecondaryOverlay />
      <SpeedOverlay />
      <SleepTimerOverlay />
      <AmbientOverlay />
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  back: {
    position: 'absolute',
    top: 40,
    left: spacing.xl,
    zIndex: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: '700',
  },
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  emptyKicker: {
    color: colors.text,
    ...typography.label,
    opacity: 0.55,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 32,
    maxWidth: 560,
    marginBottom: 18,
    opacity: 0.9,
  },
  emptyCta: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: colors.text,
    marginTop: 8,
  },
  emptyCtaText: {
    color: colors.background,
    fontFamily: fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
