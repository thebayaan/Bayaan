import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Platform, Pressable, Text, View, useTVEventHandler} from 'react-native';
import {CheckIcon, PauseIcon, PlayIcon} from '../../components/Icons';
import {AdhkarClock, useNow} from '../components/adhkar/AdhkarClock';
import {AdhkarGlow} from '../components/adhkar/AdhkarGlow';
import {CountRing} from '../components/adhkar/CountRing';
import {DhikrText} from '../components/adhkar/DhikrText';
import {ProgressDashes} from '../components/adhkar/ProgressDashes';
import {arabicFontStyle} from '../components/adhkar/arabicFont';
import {LogoMark} from '../components/brand/LogoMark';
import {FocusableButton} from '../components/primitives/FocusableButton';
import {FocusIcon, FocusText} from '../components/primitives/focusContext';
import {adhkarForList, adhkarList} from '../services/adhkarData';
import {countLabel, periodLabel} from '../services/adhkarBrowse';
import {
  arabicFontSize,
  dhikrPages,
  instructionNote,
  notesFontSize,
  pageAtProgress,
  runsLength,
  sourceLine,
  translationFontSize,
} from '../services/adhkarPages';
import {createQuranHandoff} from '../services/adhkarQuranHandoff';
import {
  createReaderKeyHandler,
  readerTransport,
  setAdhkarReaderTransport,
  type ReaderControls,
} from '../services/adhkarReaderTransport';
import {
  advanceModeOf,
  type AdhkarAudio,
  type AdvanceMode,
} from '../store/adhkarSessionController';
import {useAdhkarSessionStore} from '../store/adhkarSessionStore';
import {useKeepAwakeWhile} from '../hooks/useKeepAwakeWhile';
import {
  useNavStore,
  type AdhkarStartMode,
  type ScreenEntry,
} from '../store/navStore';
import {showToast} from '../store/toastStore';
import {useTVPlayerStore} from '../store/tvPlayerStore';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

type Props = {
  listId: string;
  /** From Search: listen straight through, or have each counted out. */
  mode?: AdhkarStartMode;
};

/**
 * How each start mode opens a list. Read is silent and at your own pace
 * (Play and Auto-advance are there when wanted, like the phone's Play all);
 * Listen through plays every recitation once, in order; Count each for me
 * plays each one as many times as it is said, counting as it goes.
 */
const START: Record<
  AdhkarStartMode,
  {autoplay: boolean; advance?: AdvanceMode}
> = {
  read: {autoplay: false},
  listen: {autoplay: true, advance: 'once'},
  count: {autoplay: true, advance: 'count'},
};

// Title-safe insets for the top bar and foot, in design px.
const SAFE_X = 96;
const SAFE_Y = 60;

// The Android fallback for the Uthmanic face draws ﴿ ﴾ as "{·".
const PLAIN_BRACKETS = Platform.OS === 'android';

/** "Morning adhkar" for the time-of-day lists, the list's title otherwise. */
function readerTitle(listId: string, title: string): string {
  return listId.endsWith('-adhkar') ? `${title} adhkar` : title;
}

function playLabel(audio: AdhkarAudio): string {
  switch (audio) {
    case 'playing':
      return 'Pause';
    case 'loading':
      return 'Loading';
    case 'error':
      return 'Retry audio';
    case 'ended':
      return 'Play again';
    default:
      return 'Play';
  }
}

/** The page to show as a dhikr opens: the first, or the last going back. */
type PageEntry = {index: number; page: number | 'last'};

/**
 * The adhkar reader: one dhikr at a time in large Arabic with its
 * translation and source, a tasbeeh ring for repeated adhkar, progress along
 * the bottom, and the recitation playing from the CDN. Left / Right move
 * (through the pages of a long dhikr first), OK counts (turning the pages of
 * a long one first), Play/Pause plays, Down reaches the audio and
 * Auto-advance chips. The transport keys work wherever focus is: Next /
 * Previous move between adhkar, Fast-forward / Rewind turn pages. Back is
 * the Router's.
 */
export function AdhkarReaderScreen({listId, mode}: Props): React.ReactElement {
  const list = adhkarList(listId);
  const adhkar = useMemo(() => adhkarForList(listId), [listId]);
  const now = useNow();
  const pop = useNavStore(s => s.pop);

  const session = useAdhkarSessionStore(s => s.session);
  const audio = useAdhkarSessionStore(s => s.audio);
  const advance = useAdhkarSessionStore(advanceModeOf);
  const resumed = useAdhkarSessionStore(s => s.resumed);
  const storedPage = useAdhkarSessionStore(s => s.page);
  const {
    open,
    close,
    press,
    next,
    prev,
    restart,
    togglePlay,
    setAutoAdvance,
    setPage,
  } = useAdhkarSessionStore.getState();

  // Whether the Quran was playing as the reader opened, and whether a
  // recitation here has since paused it, for the top bar's note.
  const [quranWasPlaying] = useState(
    () => useTVPlayerStore.getState().status === 'playing',
  );
  const [quranTaken, setQuranTaken] = useState(false);

  useEffect(() => {
    // An adhkar recitation pauses the Quran; leaving hands it back.
    // A verse repeat's gap (held) is still the Quran playing.
    const handoff = createQuranHandoff({
      quranStatus: () => {
        const player = useTVPlayerStore.getState();
        return player.held ? 'playing' : player.status;
      },
      resumeQuran: () => useTVPlayerStore.getState().toggle(),
    });
    const unsubscribe = useAdhkarSessionStore.subscribe(s => {
      if (s.audio === 'loading' || s.audio === 'playing') {
        // The gap's replay would take the audio back from the dhikr: cancel
        // it (toggle in the gap stays paused), and leaving resumes instead.
        const player = useTVPlayerStore.getState();
        if (player.held) player.toggle();
        handoff.adhkarPlayed();
        if (handoff.tookOver()) setQuranTaken(true);
      }
    });
    open(
      listId,
      adhkar.map(d => d.repeatCount),
      adhkar.map(d => d.audioUrl),
      START[mode ?? 'read'],
    );
    return () => {
      unsubscribe();
      // Still on the stack: it only went under the player (the now-playing
      // pill) and comes back on Back, on the same page, waiting for Play.
      const onStack = (stack: readonly ScreenEntry[]): boolean =>
        stack.some(e => e.screen === 'adhkarReader' && e.listId === listId);
      const covered = onStack(useNavStore.getState().stack);
      close({covered});
      if (covered) {
        // Left from under the player (a place switch clears the stack): the
        // next open is a fresh visit again, autoplay and all. A plain close
        // forgets the covered visit; skip it while another reader is open,
        // whose own close forgets it.
        const stop = useNavStore.subscribe(s => {
          if (onStack(s.stack)) return;
          stop();
          if (!useAdhkarSessionStore.getState().session) close();
        });
      }
      if (handoff.leave()) {
        const {queue, currentIndex} = useTVPlayerStore.getState();
        const surah = queue[currentIndex]?.title;
        showToast(surah ? `Resuming ${surah}` : 'Resuming the Quran');
      }
    };
  }, [listId, mode, adhkar, open, close]);

  const ready = session !== null && session.listId === listId;
  const index = ready ? session.index : 0;
  const dhikr = adhkar[index];
  const finished = ready && session.finished;
  const audioActive = audio === 'playing' || audio === 'loading';
  // Listening through (or counting) runs without a press: keep the screen on
  // while a recitation plays, and between dhikr while auto-advance carries on.
  useKeepAwakeWhile(
    !finished && (audioActive || (advance !== 'off' && audio === 'ended')),
    'adhkar-reader',
  );
  const pages = useMemo(
    () =>
      dhikr
        ? dhikrPages(dhikr.arabic, dhikr.translation, {
            plainBrackets: PLAIN_BRACKETS,
            note: instructionNote(dhikr.instruction),
          })
        : [],
    [dhikr],
  );
  // The session keeps the page (resuming, or back from the player, opens on
  // it); any other move (auto-advance, OK, start again) opens on the first.
  const [entry, setEntry] = useState<PageEntry>({index: -1, page: 0});
  useEffect(() => {
    setEntry(e =>
      e.index === index
        ? e
        : {index, page: useAdhkarSessionStore.getState().page},
    );
  }, [index]);
  const lastPage = Math.max(0, pages.length - 1);
  const page =
    entry.index !== index
      ? Math.min(storedPage, lastPage)
      : entry.page === 'last'
        ? lastPage
        : Math.min(entry.page, lastPage);
  const shown = pages[page];
  useEffect(() => {
    if (ready && !finished) setPage(page);
  }, [ready, finished, index, page, setPage]);

  // Listening through or counting, the pages of a long dhikr turn with the
  // recitation (and go back to the first as it plays again).
  const following =
    advance !== 'off' &&
    audio === 'playing' &&
    pages.filter(p => p.arabic.length > 0).length > 1;
  const followedPage = useAdhkarSessionStore(s =>
    following ? pageAtProgress(pages, s.clipProgress) : -1,
  );
  useEffect(() => {
    if (followedPage >= 0) setEntry({index, page: followedPage});
  }, [followedPage, index]);

  // Arrows act on the dhikr only while the stage has focus; on the chips
  // they move between chips. The state draws the stage's focus.
  const stageFocusedRef = useRef(false);
  const [stageFocused, setStageFocused] = useState(false);
  useEffect(() => {
    // The stage unmounts under the closing card without a blur.
    if (finished) {
      stageFocusedRef.current = false;
      setStageFocused(false);
    }
  }, [finished]);
  // A new key remounts the stage, whose preferred focus then takes focus
  // back (after Start over, whose chip goes away).
  const [stageKey, setStageKey] = useState(0);
  const pageRef = useRef({index, page, count: pages.length});
  pageRef.current = {index, page, count: pages.length};

  // One set of controls for the remote's keys and, on Vega, the system's
  // media commands, so both turn the same pages through the same store.
  const controls = useMemo<ReaderControls>(() => {
    const audioActive = (): boolean => {
      const a = useAdhkarSessionStore.getState().audio;
      return a === 'playing' || a === 'loading';
    };
    return {
      toggle: togglePlay,
      play: () => {
        if (!audioActive()) togglePlay();
      },
      pause: () => {
        if (audioActive()) togglePlay();
      },
      nextDhikr: next,
      previousDhikr: () => {
        // Like a track's Previous: the dhikr before, from its start.
        const {index: i} = pageRef.current;
        setEntry({index: Math.max(0, i - 1), page: 0});
        prev();
      },
      pageForward: () => {
        const {index: i, page: p, count} = pageRef.current;
        if (p < count - 1) setEntry({index: i, page: p + 1});
        else next();
      },
      pageBack: () => {
        const {index: i, page: p} = pageRef.current;
        if (p > 0) {
          setEntry({index: i, page: p - 1});
        } else if (i > 0) {
          // Back into the previous dhikr at its end, where it was left.
          setEntry({index: i - 1, page: 'last'});
          prev();
        }
      },
    };
  }, [togglePlay, next, prev]);
  useEffect(
    () => setAdhkarReaderTransport(readerTransport(controls)),
    [controls],
  );
  const handleTVEvent = useMemo(
    () => createReaderKeyHandler(controls, () => stageFocusedRef.current),
    [controls],
  );
  useTVEventHandler(handleTVEvent);

  const title = list ? readerTitle(list.id, list.title) : 'Adhkar';
  const color = list?.color ?? colors.accent;

  if (!list || adhkar.length === 0) {
    return (
      <View style={styles.root}>
        <AdhkarGlow color={color} />
        <View style={styles.center}>
          <Text style={styles.endTitle}>This list is empty</Text>
          <View style={styles.endActions}>
            <FocusableButton
              onPress={pop}
              outlined
              hasTVPreferredFocus
              style={styles.endButton}>
              <FocusText style={styles.endButtonText}>Back to Adhkar</FocusText>
            </FocusableButton>
          </View>
        </View>
      </View>
    );
  }

  const target = dhikr?.repeatCount ?? 1;
  const count = ready ? (session.counts[index] ?? 0) : 0;
  const done = ready
    ? session.counts.map((c, i) => c >= (session.targets[i] ?? 1))
    : [];
  const morePages = page < pages.length - 1;
  const arabicSize = arabicFontSize(shown?.arabicLength ?? 0);
  const translationSize = translationFontSize(
    runsLength(shown?.translation ?? []),
  );
  // A page of notes alone follows a dhikr whose notes would crowd it.
  const notesOnly = !!shown && shown.arabic.length === 0;
  const notesSize = notesFontSize(shown?.notes.length ?? 0, notesOnly);
  // The Names are learnt by their sound too: the transliteration under each.
  const transliteration =
    listId === 'names-of-allah' && page === 0 ? dhikr?.transliteration : '';
  const source = dhikr ? sourceLine(target, dhikr.instruction) : '';
  const sourceText = [
    source,
    pages.length > 1 ? `Page ${page + 1} of ${pages.length}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  const counting = advance !== 'off' && audio === 'playing';
  const hint = counting
    ? advance === 'once'
      ? 'Listening through'
      : 'Counting with the recitation'
    : audio === 'error' && advance !== 'off'
      ? "Couldn't play the recitation"
      : morePages
        ? 'OK for the next page'
        : count >= target
          ? 'Done · OK for the next'
          : target > 1
            ? 'OK to count'
            : 'OK when you have said it';
  // Once a recitation here has paused the Quran it stays paused (Pause on
  // the adhkar doesn't bring it back) until the reader closes.
  const quranNote = quranWasPlaying
    ? quranTaken || audioActive
      ? 'The Quran resumes when you leave'
      : 'The Quran plays on until you press Play'
    : null;

  const onStagePress = (): void => {
    // A long dhikr shows all of its pages before OK counts it.
    if (morePages) {
      setEntry({index, page: page + 1});
      return;
    }
    press();
    // Said again: each repetition of a long dhikr starts on its first page.
    const after = useAdhkarSessionStore.getState().session;
    if (
      pages.length > 1 &&
      after?.index === index &&
      (after.counts[index] ?? 0) < (after.targets[index] ?? 1)
    ) {
      setEntry({index, page: 0});
    }
  };

  // Start over (resumed) and Start again (closing card): the first page of
  // the first dhikr, whichever page that dhikr was last left on.
  const startOver = (): void => {
    restart();
    setEntry({index: 0, page: 0});
    setStageKey(k => k + 1);
  };

  const reviewLast = (): void => {
    setEntry({index: adhkar.length - 1, page: 'last'});
    prev();
  };

  return (
    <View style={styles.root}>
      <AdhkarGlow color={color} dim={finished ? 0.4 : 0} />

      <View style={styles.top} pointerEvents="none">
        <View>
          <View style={styles.brand}>
            <LogoMark size={scale(34)} color={colors.text} />
            <Text style={styles.listTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {quranNote && !finished ? (
            <Text style={styles.note} numberOfLines={1}>
              {quranNote}
            </Text>
          ) : null}
        </View>
        <AdhkarClock now={now} caption={periodLabel(now)} />
      </View>

      {finished ? (
        <View style={styles.center}>
          <Text style={styles.kicker}>COMPLETE</Text>
          <Text style={styles.endTitle}>{title}</Text>
          <Text style={styles.endBody}>
            {`${countLabel(adhkar.length)} · May Allah accept from you`}
          </Text>
          <View style={styles.endActions}>
            <FocusableButton onPress={reviewLast} style={styles.endButton}>
              <FocusText style={styles.endButtonText}>Review last</FocusText>
            </FocusableButton>
            <FocusableButton
              onPress={startOver}
              outlined
              style={styles.endButton}>
              <FocusText style={styles.endButtonText}>Start again</FocusText>
            </FocusableButton>
            {/* Focus lands on Done: the OK that counted the last dhikr is
                often pressed once more, and Start again clears every count. */}
            <FocusableButton
              onPress={pop}
              hasTVPreferredFocus
              style={styles.endButton}>
              <FocusText style={styles.endButtonText}>Done</FocusText>
            </FocusableButton>
          </View>
        </View>
      ) : (
        <Pressable
          key={stageKey}
          style={styles.stage}
          hasTVPreferredFocus
          onFocus={() => {
            stageFocusedRef.current = true;
            setStageFocused(true);
          }}
          onBlur={() => {
            stageFocusedRef.current = false;
            setStageFocused(false);
          }}
          onPress={onStagePress}
          accessibilityLabel={
            morePages
              ? 'Next page'
              : target > 1
                ? `Count, ${count} of ${target}`
                : 'Next dhikr'
          }>
          {notesOnly ? <Text style={styles.kicker}>NOTES</Text> : null}
          {shown && shown.arabic.length > 0 ? (
            <DhikrText
              runs={shown.arabic}
              fontSize={scale(arabicSize)}
              style={[
                styles.arabic,
                arabicFontStyle,
                {lineHeight: scale(arabicSize * 1.75)},
              ]}
            />
          ) : null}
          {transliteration ? (
            <Text style={styles.transliteration}>{transliteration}</Text>
          ) : null}
          {shown && shown.translation.length > 0 ? (
            <DhikrText
              runs={shown.translation}
              fontSize={scale(translationSize)}
              style={[
                styles.translation,
                {lineHeight: scale(translationSize * 1.45)},
              ]}
            />
          ) : null}
          {shown?.notes ? (
            <Text
              style={[
                styles.notes,
                notesOnly && styles.notesAlone,
                {
                  fontSize: scale(notesSize),
                  lineHeight: scale(notesSize * 1.45),
                },
              ]}>
              {shown.notes}
            </Text>
          ) : null}
          {sourceText ? (
            <Text style={styles.source} numberOfLines={2}>
              {sourceText}
            </Text>
          ) : null}
          <View style={[styles.counter, !stageFocused && styles.counterRest]}>
            {target > 1 ? (
              <>
                <CountRing
                  count={count}
                  target={target}
                  size={(shown?.arabicLength ?? 0) > 160 ? 120 : 156}
                  focused={stageFocused}
                />
                <Text style={[styles.hint, stageFocused && styles.hintFocused]}>
                  {hint}
                </Text>
              </>
            ) : (
              <View style={[styles.okPill, stageFocused && styles.okPillOn]}>
                <Text style={[styles.okText, stageFocused && styles.okTextOn]}>
                  {hint}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      )}

      <View style={styles.foot}>
        <Text style={styles.progressLabel}>
          {`${Math.min(index + 1, adhkar.length)} OF ${adhkar.length}`}
        </Text>
        <ProgressDashes
          total={adhkar.length}
          index={finished ? adhkar.length : index}
          done={done}
        />
        {/* The closing card's buttons hold focus on their own; these
            chips would do nothing there. */}
        {finished ? null : (
          <View style={styles.chips}>
            {resumed ? (
              <FocusableButton
                onPress={startOver}
                style={styles.chip}
                accessibilityLabel="Resumed where you left off. Start over">
                <FocusText style={styles.chipText}>
                  Resumed · Start over
                </FocusText>
              </FocusableButton>
            ) : null}
            <FocusableButton
              onPress={togglePlay}
              style={styles.chip}
              accessibilityLabel={playLabel(audio)}>
              <View style={styles.chipInner}>
                <FocusIcon
                  icon={audio === 'playing' ? PauseIcon : PlayIcon}
                  size={22}
                />
                <FocusText style={styles.chipText}>
                  {playLabel(audio)}
                </FocusText>
              </View>
            </FocusableButton>
            <FocusableButton
              onPress={() => setAutoAdvance(advance === 'off')}
              style={styles.chip}
              accessibilityLabel={`Auto-advance ${advance === 'off' ? 'off' : 'on'}`}>
              {focused => (
                <View style={styles.chipInner}>
                  {advance !== 'off' ? (
                    <CheckIcon
                      color={focused ? colors.onFocus : colors.accent}
                      size={scale(22)}
                    />
                  ) : null}
                  <FocusText
                    style={styles.chipText}
                    color={
                      advance !== 'off' ? colors.text : colors.textSecondary
                    }>
                    Auto-advance
                  </FocusText>
                </View>
              )}
            </FocusableButton>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1, backgroundColor: colors.background},
  // The top bar and foot keep inside the title-safe area (90 x 60 at 1080p).
  top: {
    position: 'absolute',
    top: SAFE_Y,
    left: SAFE_X,
    right: SAFE_X,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4},
  listTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 26,
    maxWidth: 900,
  },
  stage: {
    position: 'absolute',
    top: 150,
    bottom: 170,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 160,
  },
  arabic: {
    color: colors.text,
    textAlign: 'center',
    maxWidth: 1560,
  },
  translation: {
    marginTop: 22,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 1320,
  },
  transliteration: {
    marginTop: 4,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 30,
    textAlign: 'center',
  },
  // Notes: the translator's glossary, a Name's meaning. Under the
  // translation, or a page of their own after the last.
  notes: {
    marginTop: 18,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 1320,
  },
  notesAlone: {marginTop: 16, color: colors.text},
  source: {
    marginTop: 16,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 23,
    textAlign: 'center',
    maxWidth: 1320,
  },
  note: {
    marginTop: 10,
    marginLeft: 48,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 20,
  },
  counter: {marginTop: 36, alignItems: 'center', justifyContent: 'center'},
  // Focus is on the chips: the counter steps back.
  counterRest: {opacity: 0.55},
  hint: {
    marginTop: 12,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 23,
  },
  hintFocused: {color: colors.text},
  // A single dhikr's "OK when you have said it", cream while OK means it.
  okPill: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  okPillOn: {
    backgroundColor: colors.focusFill,
    borderColor: colors.focusFill,
  },
  okText: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 21,
  },
  okTextOn: {color: colors.onFocus},
  foot: {
    position: 'absolute',
    left: SAFE_X,
    right: SAFE_X,
    bottom: SAFE_Y,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2,
    minWidth: 130,
  },
  chips: {flexDirection: 'row', gap: 10},
  chip: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chipInner: {flexDirection: 'row', alignItems: 'center', gap: 10},
  chipText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 21},
  center: {
    position: 'absolute',
    top: 150,
    bottom: 170,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 3,
  },
  endTitle: {
    marginTop: 14,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontWeight: '800',
    fontSize: 56,
  },
  endBody: {
    marginTop: 12,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 24,
  },
  endActions: {flexDirection: 'row', gap: 16, marginTop: 40},
  endButton: {borderRadius: 16, paddingHorizontal: 36, paddingVertical: 16},
  endButtonText: {fontFamily: fonts.bold, fontWeight: '700', fontSize: 24},
});
