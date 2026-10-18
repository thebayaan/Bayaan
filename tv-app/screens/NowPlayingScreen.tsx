import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
} from 'react-native';
import type {HWEvent} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {GlowBackdrop} from '../components/listening/GlowBackdrop';
import {VerseStage} from '../components/listening/VerseStage';
import {ControlsTray} from '../components/listening/ControlsTray';
import {ListeningPanels} from '../components/listening/ListeningPanels';
import {ListeningFooter} from '../components/listening/ListeningFooter';
import {ControlsHint} from '../components/listening/ControlsHint';
import {ErrorBanner} from '../components/player/ErrorBanner';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {SLEEP_FADE_MS, useTVPlayerStore} from '../store/tvPlayerStore';
import {useNavStore} from '../store/navStore';
import {useContextMenuStore} from '../store/contextMenuStore';
import {footerChips, useListeningStore} from '../store/listeningStore';
import {textScale, useDisplayStore} from '../store/displayStore';
import {ambientLabel, useAmbientStore} from '../store/ambientStore';
import {useReciters} from '../hooks/useReciters';
import {usePlayer} from '../hooks/usePlayer';
import {useVerseSync} from '../hooks/useVerseSync';
import {useKeepAwakeWhile} from '../hooks/useKeepAwakeWhile';
import {
  advanceRepeat,
  stepTarget,
  verseAt,
  verseSpan,
  verseTicks,
  type VerseTimeline,
} from '../services/verseTimeline';
import {createRemoteKeyFilter} from '../services/remoteKeys';
import {AMBIENT_AVAILABLE} from '../services/ambientPlayer';
import {startAmbientSync} from '../services/ambientSync';
import {rewayahLabel, type ReciterChoice} from '../services/listeningChoices';
import {colors} from '../theme/colors';
import {fonts, typography} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles} from '../theme/scale';

/** Seek step for recitations without verse timings. */
const SEEK_STEP_SECONDS = 15;
/** The tray lowers itself after this long without a press. */
const TRAY_IDLE_MS = 8000;
/** How long "Press OK for controls" is up when the player opens. */
const HINT_MS = 6000;

// The ambience follows the recitation app-wide, wherever playback starts.
startAmbientSync();

/**
 * The listening room: the verse being recited and its translation, full
 * screen over the surah's color field. Controls stay out of the way until OK
 * raises the tray. With the tray down, Left/Right step a verse (or 15 seconds
 * when the recitation has no verse timings) and holding OK repeats the verse.
 */
export function NowPlayingScreen(): React.ReactElement {
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const position = useTVPlayerStore(s => s.positionSeconds);
  const duration = useTVPlayerStore(s => s.durationSeconds);
  const sleep = useTVPlayerStore(s => s.sleep);
  const toggle = useTVPlayerStore(s => s.toggle);
  const seekBy = useTVPlayerStore(s => s.seekBy);
  const seekTo = useTVPlayerStore(s => s.seekTo);
  const resetNav = useNavStore(s => s.reset);
  const trayOpen = useListeningStore(s => s.trayOpen);
  const setTrayOpen = useListeningStore(s => s.setTrayOpen);
  const repeat = useListeningStore(s => s.repeat);
  const verseRepeat = useListeningStore(s => s.verseRepeat);
  const setRepeat = useListeningStore(s => s.setRepeat);
  const setVerseRepeat = useListeningStore(s => s.setVerseRepeat);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const panel = useListeningStore(s => s.panel);
  // A menu over the player (the Save tool's playlist picker) keeps the tray up.
  const menuOpen = useContextMenuStore(s => s.target !== null);
  const repeatPauseMs = useListeningStore(s => s.repeatPauseMs);
  const onScreen = useDisplayStore(s => s.mode);
  const edition = useDisplayStore(s => s.edition);
  const textSize = useDisplayStore(s => s.textSize);
  const dimAfterMin = useDisplayStore(s => s.dimAfterMin);
  const speed = useTVPlayerStore(s => s.speed);
  const status = useTVPlayerStore(s => s.status);
  const ambientOn = useAmbientStore(s => s.enabled);
  const ambientSound = useAmbientStore(s => s.currentSound);
  const {reciters} = useReciters();
  const {playRewayah} = usePlayer();
  // No screensaver over the verse while it is being recited.
  useKeepAwakeWhile(
    status === 'playing' || status === 'loading' || status === 'buffering',
    'listening-room',
  );

  const item = queue[currentIndex];
  const reciter = item
    ? (reciters.find(r => r.id === item.reciterId) ?? null)
    : null;
  const rewayah =
    item && reciter
      ? (reciter.rewayat.find(rw => rw.id === item.rewayahId) ?? null)
      : null;

  const sync = useVerseSync(
    item?.surahNumber ?? null,
    item?.rewayahId,
    rewayah?.name ?? '',
    edition,
  );
  const {timeline} = sync;
  const positionMs = position * 1000;
  const currentAyah = timeline ? verseAt(timeline, positionMs) : null;
  const ticks = useMemo(
    () => (timeline ? verseTicks(timeline, duration * 1000) : []),
    [timeline, duration],
  );

  // Idle handling: the tray lowers after a few seconds, the screen dims after
  // ten minutes, and the opening hint fades. Every remote press counts.
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [openedAt] = useState(() => Date.now());
  // The hint is for the first moments only, not every time the tray lowers.
  const [trayUsed, setTrayUsed] = useState(false);
  useEffect(() => {
    if (trayOpen) setTrayUsed(true);
  }, [trayOpen]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const markActivity = useCallback(() => setLastActivity(Date.now()), []);
  const idleMs = now - lastActivity;
  const dimmed = dimAfterMin > 0 && idleMs > dimAfterMin * 60 * 1000;
  // With a sleep timer, the screen fades toward black along with the audio.
  const sleepLeftMs = sleep.kind === 'timer' ? sleep.endsAt - now : Infinity;
  const sleepFade =
    sleepLeftMs < SLEEP_FADE_MS
      ? 0.85 * (1 - Math.max(0, sleepLeftMs) / SLEEP_FADE_MS)
      : 0;
  const showHint = !trayOpen && !trayUsed && now - openedAt < HINT_MS;

  useEffect(() => {
    // A panel stays up until Back, since reading a list takes a while.
    if (trayOpen && !panel && !menuOpen && idleMs > TRAY_IDLE_MS) {
      setTrayOpen(false);
    }
  }, [trayOpen, panel, menuOpen, idleMs, setTrayOpen]);

  // Leaving the player lowers the tray so it isn't up next time.
  useEffect(() => () => setTrayOpen(false), [setTrayOpen]);

  // A new surah ends any verse repeat from the last one.
  const surahKey = item
    ? `${item.reciterId}:${item.rewayahId}:${item.surahNumber}`
    : '';
  useEffect(() => {
    setVerseRepeat(null);
    if (useListeningStore.getState().repeat.kind === 'verse') {
      setRepeat({kind: 'off'}, 0);
    }
  }, [surahKey, setRepeat, setVerseRepeat]);

  // Verse repeat: send playback back to the verse start until the count runs
  // out, then let it carry on. With a pause set, playback waits at the verse
  // start before each replay, so the listener can recite it back.
  const lastRepeatSeek = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!timeline || !verseRepeat) return;
    // Ignore the stale positions that arrive just after a seek.
    if (Date.now() - lastRepeatSeek.current < 600) return;
    if (resumeTimer.current) return;
    const result = advanceRepeat(timeline, verseRepeat, positionMs);
    if (result.seekToMs !== null) {
      lastRepeatSeek.current = Date.now();
      seekTo(result.seekToMs / 1000);
      setVerseRepeat(result.repeat);
      if (repeatPauseMs > 0) {
        const engine = useTVPlayerStore.getState().engine;
        engine?.pause();
        resumeTimer.current = setTimeout(() => {
          resumeTimer.current = null;
          lastRepeatSeek.current = Date.now();
          void engine?.play();
        }, repeatPauseMs);
      }
    } else if (result.done) {
      setRepeat({kind: 'off'}, 0);
    }
  }, [
    timeline,
    verseRepeat,
    positionMs,
    repeatPauseMs,
    seekTo,
    setVerseRepeat,
    setRepeat,
  ]);
  // Turning repeat off, or leaving, cancels a pending replay.
  useEffect(() => {
    if (verseRepeat || !resumeTimer.current) return;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  }, [verseRepeat]);
  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  // Switching reciter mid-surah picks up at the same verse once the new
  // recitation's timings arrive (or at the start when it has none). The old
  // timeline is kept to tell the new one apart from it.
  const resume = useRef<{
    key: string;
    ayah: number;
    stale: VerseTimeline | null;
  } | null>(null);
  const switchReciter = useCallback(
    (choice: ReciterChoice) => {
      if (!item) return;
      const ayah = timeline ? (currentAyah ?? 0) : 0;
      resume.current =
        ayah > 1
          ? {
              key: `${choice.reciter.id}:${choice.rewayah.id}:${item.surahNumber}`,
              ayah,
              stale: timeline,
            }
          : null;
      void playRewayah(
        choice.reciter.id,
        choice.reciter.name,
        choice.rewayah,
        item.surahNumber,
        {shuffle: useTVPlayerStore.getState().shuffle},
      );
    },
    [item, timeline, currentAyah, playRewayah],
  );
  useEffect(() => {
    const pending = resume.current;
    if (!pending || pending.key !== surahKey) return;
    if (!sync.timingsSettled || timeline === pending.stale) return;
    if (status !== 'playing') return;
    resume.current = null;
    const span = timeline ? verseSpan(timeline, pending.ayah) : null;
    if (span) {
      lastRepeatSeek.current = Date.now();
      seekTo(span.fromMs / 1000);
    }
  }, [surahKey, sync.timingsSettled, timeline, status, seekTo]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!timeline) {
        seekBy(direction * SEEK_STEP_SECONDS);
        return;
      }
      const target = stepTarget(timeline, positionMs, direction);
      if (target === null) return;
      lastRepeatSeek.current = Date.now();
      seekTo(target / 1000);
      // Stepping while a verse repeats moves the repeat to the new verse.
      const repeating = useListeningStore.getState().verseRepeat;
      if (repeating) {
        setVerseRepeat({
          ...repeating,
          ayah: verseAt(timeline, target),
          played: 0,
        });
      }
    },
    [timeline, positionMs, seekBy, seekTo, setVerseRepeat],
  );

  const repeatCurrentVerse = useCallback(() => {
    if (currentAyah && currentAyah > 0) {
      setRepeat({kind: 'verse', times: Infinity}, currentAyah);
    }
  }, [currentAyah, setRepeat]);

  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      markActivity();
      const action = remoteFilter(event);
      if (action === 'playPause') {
        toggle();
        return;
      }
      // With the tray up, arrows move focus between its controls.
      if (useListeningStore.getState().trayOpen) return;
      if (action === 'right' || action === 'seekForward') step(1);
      else if (action === 'left' || action === 'seekBackward') step(-1);
    },
    [markActivity, remoteFilter, toggle, step],
  );
  useTVEventHandler(handleTVEvent);

  if (!item) {
    return (
      <View style={styles.container}>
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
            outlined
            hasTVPreferredFocus>
            <FocusText style={styles.emptyCtaText}>Browse reciters</FocusText>
          </FocusableButton>
        </View>
      </View>
    );
  }

  const reciterName = reciter?.name ?? item.subtitle;
  const repeatNote =
    verseRepeat && verseRepeat.ayah === currentAyah
      ? Number.isFinite(verseRepeat.times)
        ? `repeating ${Math.min(verseRepeat.played + 1, verseRepeat.times)} of ${verseRepeat.times}`
        : 'repeating'
      : null;
  // Before the timing lookup settles, show the opening rather than flash the
  // "not synced" layout.
  const stageAyah = sync.timingsSettled ? currentAyah : 0;
  const chips = footerChips({
    repeat,
    speed,
    ambient: AMBIENT_AVAILABLE && ambientOn ? ambientLabel(ambientSound) : null,
    sleepOn: sleep.kind !== 'off',
    sleepChoice,
  });

  return (
    <View style={styles.container}>
      <GlowBackdrop surahNumber={item.surahNumber} dim={trayOpen ? 0.3 : 0} />
      <VerseStage
        surahNumber={item.surahNumber}
        surahName={item.title}
        ayah={stageAyah}
        arabic={sync.arabic}
        translation={sync.translation}
        compact={trayOpen}
        note={repeatNote}
        show={onScreen}
        textScale={textScale(textSize)}
        besidePanel={panel !== null}
      />

      {trayOpen ? (
        <>
          <Svg
            style={styles.trayScrim}
            width="100%"
            height="100%"
            pointerEvents="none">
            <Defs>
              <LinearGradient id="tray-scrim" x1="0" y1="1" x2="0" y2="0">
                <Stop
                  offset="0"
                  stopColor={colors.background}
                  stopOpacity={0.97}
                />
                <Stop
                  offset="1"
                  stopColor={colors.background}
                  stopOpacity={0}
                />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#tray-scrim)"
            />
          </Svg>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
            <Text style={styles.titleSub}>{`  ·  ${reciterName}`}</Text>
          </Text>
          <ControlsTray
            synced={timeline !== null}
            ticks={ticks}
            onStep={step}
            reciterName={reciterName}
            onActivity={markActivity}
          />
          <ListeningPanels
            currentAyah={currentAyah ?? 0}
            synced={timeline !== null}
            onActivity={markActivity}
            reciters={reciters}
            rewayahName={rewayah?.name ?? ''}
            onSwitchReciter={switchReciter}
          />
        </>
      ) : (
        <>
          {/* Holds focus while the tray is down so OK and the arrows reach this screen. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            hasTVPreferredFocus
            accessibilityLabel="Show player controls"
            onPress={() => {
              markActivity();
              setTrayOpen(true);
            }}
            onLongPress={() => {
              markActivity();
              repeatCurrentVerse();
            }}
          />
          {showHint ? <ControlsHint /> : null}
          <ListeningFooter
            reciter={reciter}
            reciterName={reciterName}
            rewayah={rewayahLabel(rewayah)}
            progress={duration > 0 ? position / duration : 0}
            chips={chips}
          />
        </>
      )}

      {dimmed ? <View style={styles.dim} pointerEvents="none" /> : null}
      {sleepFade > 0 ? (
        <View
          style={[styles.fade, {opacity: sleepFade}]}
          pointerEvents="none"
        />
      ) : null}
      <ErrorBanner />
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: colors.background},
  trayScrim: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 520},
  title: {
    position: 'absolute',
    top: 56,
    left: 96,
    right: 96,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 30,
  },
  titleSub: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 24,
  },
  dim: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)'},
  fade: {...StyleSheet.absoluteFillObject, backgroundColor: '#000'},
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  emptyKicker: {color: colors.text, ...typography.label, opacity: 0.55},
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
    borderRadius: 16,
    marginTop: 8,
  },
  emptyCtaText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: '700',
  },
});
