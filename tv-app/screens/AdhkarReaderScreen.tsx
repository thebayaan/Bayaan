import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, Pressable, Text, View, useTVEventHandler} from 'react-native';
import type {HWEvent} from 'react-native';
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
  sourceLine,
  translationFontSize,
} from '../services/adhkarPages';
import {createQuranHandoff} from '../services/adhkarQuranHandoff';
import {createRemoteKeyFilter} from '../services/remoteKeys';
import {
  advanceModeOf,
  type AdhkarAudio,
  type AdvanceMode,
} from '../store/adhkarSessionController';
import {useAdhkarSessionStore} from '../store/adhkarSessionStore';
import {useKeepAwakeWhile} from '../hooks/useKeepAwakeWhile';
import {useNavStore, type AdhkarStartMode} from '../store/navStore';
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
 * Auto-advance chips. Back is the Router's.
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
  const {open, close, press, next, prev, restart, togglePlay, setAutoAdvance} =
    useAdhkarSessionStore.getState();

  // Whether the Quran was playing as the reader opened, for the foot's note.
  const [quranWasPlaying] = useState(
    () => useTVPlayerStore.getState().status === 'playing',
  );

  useEffect(() => {
    // An adhkar recitation pauses the Quran; leaving hands it back.
    const handoff = createQuranHandoff({
      quranStatus: () => useTVPlayerStore.getState().status,
      resumeQuran: () => useTVPlayerStore.getState().toggle(),
    });
    const unsubscribe = useAdhkarSessionStore.subscribe(s => {
      if (s.audio === 'loading' || s.audio === 'playing') {
        handoff.adhkarPlayed();
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
      close();
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
          })
        : [],
    [dhikr],
  );
  const [entry, setEntry] = useState<PageEntry>({index: 0, page: 0});
  // Any other move (auto-advance, OK, start again) opens on the first page.
  useEffect(() => {
    setEntry(e => (e.index === index ? e : {index, page: 0}));
  }, [index]);
  const lastPage = Math.max(0, pages.length - 1);
  const page =
    entry.index !== index
      ? 0
      : entry.page === 'last'
        ? lastPage
        : Math.min(entry.page, lastPage);
  const shown = pages[page];

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

  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      const action = remoteFilter(event);
      if (!action) return;
      if (action === 'playPause') {
        togglePlay();
        return;
      }
      if (!stageFocusedRef.current) return;
      const {index: i, page: p, count} = pageRef.current;
      if (action === 'right' || action === 'seekForward') {
        if (p < count - 1) setEntry({index: i, page: p + 1});
        else next();
      } else if (p > 0) {
        setEntry({index: i, page: p - 1});
      } else if (i > 0) {
        // Back into the previous dhikr at its end, where it was left.
        setEntry({index: i - 1, page: 'last'});
        prev();
      }
    },
    [remoteFilter, togglePlay, next, prev],
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
  const translationChars = (shown?.translation ?? []).reduce(
    (n, r) => n + r.text.length,
    0,
  );
  const translationSize = translationFontSize(translationChars);
  const source = dhikr ? sourceLine(target, dhikr.instruction) : '';
  const sourceText = [
    source,
    pages.length > 1 ? `Page ${page + 1} of ${pages.length}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  const counting = advance !== 'off' && audio === 'playing';
  const hint = morePages
    ? 'OK for the next page'
    : counting
      ? advance === 'once'
        ? 'Listening through'
        : 'Counting with the recitation'
      : count >= target
        ? 'Done'
        : target > 1
          ? 'OK to count'
          : 'OK when you have said it';
  const quranNote = quranWasPlaying
    ? audioActive
      ? 'The Quran resumes when you leave'
      : 'The Quran plays on until you press Play'
    : null;

  const onStagePress = (): void => {
    // A long dhikr shows all of its pages before OK counts it.
    if (morePages) setEntry({index, page: page + 1});
    else press();
  };

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
              onPress={restart}
              outlined
              hasTVPreferredFocus
              style={styles.endButton}>
              <FocusText style={styles.endButtonText}>Start again</FocusText>
            </FocusableButton>
            <FocusableButton onPress={pop} style={styles.endButton}>
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
          {shown ? (
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
                accessibilityLabel={`Resumed at ${index + 1} of ${adhkar.length}. Start over`}>
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
  top: {
    position: 'absolute',
    top: 56,
    left: 72,
    right: 72,
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
  source: {
    marginTop: 16,
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
    textAlign: 'center',
    maxWidth: 1320,
  },
  note: {
    marginTop: 10,
    marginLeft: 48,
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 18,
  },
  counter: {marginTop: 36, alignItems: 'center', justifyContent: 'center'},
  // Focus is on the chips: the counter steps back.
  counterRest: {opacity: 0.55},
  hint: {
    marginTop: 12,
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
  },
  hintFocused: {color: colors.textSecondary},
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
    left: 72,
    right: 72,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 2,
    minWidth: 110,
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
