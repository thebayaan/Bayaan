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
import {PANEL_WIDTH} from '../components/listening/SidePanel';
import {ErrorBanner} from '../components/player/ErrorBanner';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusText} from '../components/primitives/focusContext';
import {SLEEP_FADE_MS, useTVPlayerStore} from '../store/tvPlayerStore';
import {useNavStore} from '../store/navStore';
import {
  footerChips,
  itemKey,
  noteRepeatSeek,
  startVerseRepeatSync,
  useListeningStore,
} from '../store/listeningStore';
import {textScale, useDisplayStore} from '../store/displayStore';
import {ambientLabel, useAmbientStore} from '../store/ambientStore';
import {showToast} from '../store/toastStore';
import {useReciters} from '../hooks/useReciters';
import {usePlayer} from '../hooks/usePlayer';
import {syncKey, useVerseSync} from '../hooks/useVerseSync';
import {useKeepAwakeWhile} from '../hooks/useKeepAwakeWhile';
import {
  stepTarget,
  verseAt,
  verseSpan,
  verseTicks,
  type VerseTimeline,
} from '../services/verseTimeline';
import {createRemoteKeyFilter} from '../services/remoteKeys';
import {createSeekStepper} from '../services/seekStep';
import {AMBIENT_AVAILABLE} from '../services/ambientPlayer';
import {startAmbientSync} from '../services/ambientSync';
import {rewayahLabel, type ReciterChoice} from '../services/listeningChoices';
import {colors} from '../theme/colors';
import {fonts, typography} from '../theme/typography';
import {spacing} from '../theme/spacing';
import {createScaledStyles} from '../theme/scale';

/** The tray lowers itself after this long without a press. */
const TRAY_IDLE_MS = 8000;
/**
 * Left/Right this soon after the tray lowered itself were meant for the
 * tray, so they don't step a verse.
 */
const TRAY_LOWERED_GUARD_MS = 1000;
/** How long the hint is up once the recitation starts. */
const HINT_MS = 6000;
/** How dark the room gets at the end of a sleep timer, and stays. */
const SLEPT_SHADE = 0.92;
/**
 * The press that wakes a dimmed or slept room only wakes it; events this
 * soon after (the same press seen twice) are swallowed too.
 */
const WAKE_SWALLOW_MS = 400;
/**
 * Holding OK to wake the room reaches onLongPress well after the press that
 * woke it, so a long press this soon after waking isn't a verse repeat.
 */
const WAKE_SWALLOW_LONG_MS = 1500;

// The ambience follows the recitation app-wide, wherever playback starts,
// and so does a verse repeat while the listener browses.
startAmbientSync();
startVerseRepeatSync();

/**
 * The listening room: the verse being recited and its translation, full
 * screen over the surah's color field. Controls stay out of the way until OK
 * raises the tray. With the tray down, Left/Right step a verse (or 15 seconds
 * and more when the recitation has no verse timings) and holding OK repeats
 * the verse.
 */
export function NowPlayingScreen(): React.ReactElement {
  const queue = useTVPlayerStore(s => s.queue);
  const currentIndex = useTVPlayerStore(s => s.currentIndex);
  const position = useTVPlayerStore(s => s.positionSeconds);
  const duration = useTVPlayerStore(s => s.durationSeconds);
  const sleep = useTVPlayerStore(s => s.sleep);
  const slept = useTVPlayerStore(s => s.slept);
  const held = useTVPlayerStore(s => s.held);
  const finished = useTVPlayerStore(s => s.finished);
  const toggle = useTVPlayerStore(s => s.toggle);
  const wake = useTVPlayerStore(s => s.wake);
  const seekBy = useTVPlayerStore(s => s.seekBy);
  const seekTo = useTVPlayerStore(s => s.seekTo);
  const switchTab = useNavStore(s => s.switchTab);
  const trayOpen = useListeningStore(s => s.trayOpen);
  const setTrayOpen = useListeningStore(s => s.setTrayOpen);
  const repeat = useListeningStore(s => s.repeat);
  const verseRepeat = useListeningStore(s => s.verseRepeat);
  const setRepeat = useListeningStore(s => s.setRepeat);
  const setVerseRepeat = useListeningStore(s => s.setVerseRepeat);
  const setTimeline = useListeningStore(s => s.setTimeline);
  const sleepChoice = useListeningStore(s => s.sleepChoice);
  const panel = useListeningStore(s => s.panel);
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
    status === 'playing' ||
      status === 'loading' ||
      status === 'buffering' ||
      held,
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
  // The hook's state still holds the last surah for one render after the
  // track changes; none of it counts until it is for this one.
  const fresh =
    item !== undefined &&
    sync.loadedFor === syncKey(item.surahNumber, item.rewayahId);
  const timeline = fresh ? sync.timeline : null;
  const timingsSettled = fresh && sync.timingsSettled;
  const positionMs = position * 1000;
  const currentAyah = timeline ? verseAt(timeline, positionMs) : null;
  const ticks = useMemo(
    () => (timeline ? verseTicks(timeline, duration * 1000) : []),
    [timeline, duration],
  );

  // The timings go to the listening store, which keeps a verse repeat going
  // against them after the listener leaves the room.
  const surahKey = itemKey(item);
  useEffect(() => {
    if (surahKey && timingsSettled) setTimeline(surahKey, timeline);
  }, [surahKey, timingsSettled, timeline, setTimeline]);

  // Idle handling: the tray lowers after a few seconds, the screen dims after
  // the chosen minutes, and the opening hint fades. Every remote press counts.
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  // The hint is for the first moments only, not every time the tray lowers.
  const [trayUsed, setTrayUsed] = useState(false);
  useEffect(() => {
    if (trayOpen) setTrayUsed(true);
  }, [trayOpen]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const markActivity = useCallback(() => {
    const t = Date.now();
    setLastActivity(t);
    setNow(t);
  }, []);
  const idleMs = now - lastActivity;
  const dimmed = dimAfterMin > 0 && idleMs > dimAfterMin * 60 * 1000;
  const dimmedRef = useRef(dimmed);
  dimmedRef.current = dimmed;
  // With a sleep timer, the screen fades toward black along with the audio,
  // and stays dark once the timer has stopped playback.
  const sleepLeftMs = sleep.kind === 'timer' ? sleep.endsAt - now : Infinity;
  const sleepShade = slept
    ? SLEPT_SHADE
    : sleepLeftMs < SLEEP_FADE_MS
      ? SLEPT_SHADE * (1 - Math.max(0, sleepLeftMs) / SLEEP_FADE_MS)
      : 0;

  // The hint's clock starts when the recitation does, not when the room
  // opens, so a slow load doesn't use it up.
  const [hintFrom, setHintFrom] = useState<number | null>(null);
  useEffect(() => {
    if (hintFrom === null && status === 'playing') setHintFrom(Date.now());
  }, [status, hintFrom]);
  const showHint =
    !trayOpen && !trayUsed && hintFrom !== null && now - hintFrom < HINT_MS;

  const trayLoweredAt = useRef(0);
  useEffect(() => {
    // A panel stays up until Back, since reading a list takes a while.
    if (trayOpen && !panel && idleMs > TRAY_IDLE_MS) {
      trayLoweredAt.current = Date.now();
      setTrayOpen(false);
    }
  }, [trayOpen, panel, idleMs, setTrayOpen]);
  // Closing a panel (Back on Android never reaches the TV event handler)
  // starts the tray's idle time over, so it doesn't drop at once.
  useEffect(() => {
    if (panel === null) markActivity();
  }, [panel, markActivity]);

  // Leaving the player lowers the tray so it isn't up next time.
  useEffect(() => () => setTrayOpen(false), [setTrayOpen]);
  // Back from the playlist editor its Save panel opened: the tray and the
  // panel come back as they were left.
  useEffect(() => {
    const {reopen} = useListeningStore.getState();
    if (reopen === null) return;
    useListeningStore.setState({reopen: null, trayOpen: true, panel: reopen});
  }, []);

  // An error card or the sleep timer's dark room has the screen to itself.
  const errored = status === 'error';
  useEffect(() => {
    if (errored || slept) setTrayOpen(false);
  }, [errored, slept, setTrayOpen]);

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
    if (!timingsSettled || timeline === pending.stale) return;
    if (status !== 'playing') return;
    resume.current = null;
    const span = timeline ? verseSpan(timeline, pending.ayah) : null;
    if (span) {
      noteRepeatSeek();
      seekTo(span.fromMs / 1000);
    }
  }, [surahKey, timingsSettled, timeline, status, seekTo]);

  const seekStep = useMemo(() => createSeekStepper(), []);
  const step = useCallback(
    (direction: 1 | -1) => {
      if (!timeline) {
        seekBy(seekStep(direction));
        return;
      }
      const target = stepTarget(timeline, positionMs, direction);
      if (target === null) return;
      noteRepeatSeek();
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
    [timeline, positionMs, seekBy, seekStep, seekTo, setVerseRepeat],
  );

  const repeatCurrentVerse = useCallback(() => {
    // Without timings there is no verse to hold on to.
    if (currentAyah === null) return;
    const ayah = Math.max(1, currentAyah);
    setRepeat({kind: 'verse', times: Infinity}, ayah);
    showToast(`Repeating verse ${ayah}`);
  }, [currentAyah, setRepeat]);

  // The press that wakes a dimmed room, or one a sleep timer left dark,
  // only wakes it.
  const wokeAt = useRef(0);
  const wakeIfAsleep = useCallback(
    (swallowMs: number = WAKE_SWALLOW_MS): boolean => {
      if (Date.now() - wokeAt.current < swallowMs) return true;
      const asleep = useTVPlayerStore.getState().slept || dimmedRef.current;
      if (!asleep) return false;
      wokeAt.current = Date.now();
      wake();
      markActivity();
      return true;
    },
    [wake, markActivity],
  );

  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      // Focus moving between the tray's buttons isn't a press.
      if (event.eventType === 'focus' || event.eventType === 'blur') return;
      if (wakeIfAsleep()) return;
      markActivity();
      // A brush of the Siri Remote's touch surface isn't a request to skip.
      if (event.eventType === 'swipeLeft' || event.eventType === 'swipeRight') {
        return;
      }
      const action = remoteFilter(event);
      if (action === 'playPause') {
        toggle();
        return;
      }
      // With the tray up, arrows move focus between its controls; with the
      // error card up, between its buttons.
      const {trayOpen: open} = useListeningStore.getState();
      if (open || useTVPlayerStore.getState().status === 'error') return;
      if (Date.now() - trayLoweredAt.current < TRAY_LOWERED_GUARD_MS) return;
      if (action === 'right' || action === 'seekForward') step(1);
      else if (action === 'left' || action === 'seekBackward') step(-1);
    },
    [wakeIfAsleep, markActivity, remoteFilter, toggle, step],
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
            onPress={() => switchTab('reciters')}
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
  const stageAyah = timingsSettled ? currentAyah : 0;
  const chips = footerChips({
    repeat,
    speed,
    ambient: AMBIENT_AVAILABLE && ambientOn ? ambientLabel(ambientSound) : null,
    sleepOn: sleep.kind !== 'off',
    sleepChoice,
  });
  // A verse repeat's gap is part of listening, not a pause.
  const playState =
    status === 'loading' || status === 'buffering'
      ? 'Loading'
      : status === 'playing' || held || errored
        ? null
        : finished
          ? 'Finished'
          : 'Paused';
  const showTray = trayOpen && !errored;

  return (
    <View style={styles.container}>
      <GlowBackdrop surahNumber={item.surahNumber} dim={showTray ? 0.3 : 0} />
      <VerseStage
        surahNumber={item.surahNumber}
        surahName={item.title}
        ayah={stageAyah}
        arabic={fresh ? sync.arabic : []}
        translation={fresh ? sync.translation : null}
        compact={showTray}
        note={repeatNote}
        show={onScreen}
        textScale={textScale(textSize)}
        besidePanel={showTray && panel !== null}
      />

      {showTray ? (
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
          <Text
            style={[styles.title, panel !== null && styles.titleBesidePanel]}
            numberOfLines={1}>
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
          {/* Holds focus while the tray is down so OK and the arrows reach
              this screen. The error card takes its place while it shows. */}
          {errored ? null : (
            <Pressable
              style={StyleSheet.absoluteFill}
              hasTVPreferredFocus
              accessibilityLabel="Show player controls"
              onPress={() => {
                if (wakeIfAsleep()) return;
                markActivity();
                setTrayOpen(true);
              }}
              onLongPress={() => {
                if (wakeIfAsleep(WAKE_SWALLOW_LONG_MS)) return;
                markActivity();
                repeatCurrentVerse();
              }}
            />
          )}
          {showHint ? <ControlsHint synced={timeline !== null} /> : null}
          <ListeningFooter
            reciter={reciter}
            reciterName={reciterName}
            rewayah={rewayahLabel(rewayah)}
            progress={duration > 0 ? position / duration : 0}
            chips={chips}
            state={playState}
          />
        </>
      )}

      {dimmed && !slept ? (
        <View style={styles.dim} pointerEvents="none" />
      ) : null}
      {sleepShade > 0 ? (
        <View
          style={[styles.fade, {opacity: sleepShade}]}
          pointerEvents="none"
        />
      ) : null}
      {slept ? (
        <Text style={styles.sleptNote} pointerEvents="none">
          Sleep timer ended · Press any button to wake
        </Text>
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
  titleBesidePanel: {right: PANEL_WIDTH + 48},
  titleSub: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 24,
  },
  dim: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)'},
  fade: {...StyleSheet.absoluteFillObject, backgroundColor: '#000'},
  sleptNote: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 18,
    opacity: 0.6,
  },
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
