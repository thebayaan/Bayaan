import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, Text, View, useTVEventHandler} from 'react-native';
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
import {createRemoteKeyFilter} from '../services/remoteKeys';
import type {AdhkarAudio} from '../store/adhkarSessionController';
import {useAdhkarSessionStore} from '../store/adhkarSessionStore';
import {useNavStore} from '../store/navStore';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {createScaledStyles, scale} from '../theme/scale';

type Props = {listId: string};

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

/**
 * The adhkar reader: one dhikr at a time in large Arabic with its
 * translation and source, a tasbeeh ring for repeated adhkar, progress along
 * the bottom, and the recitation playing from the CDN. Left / Right move
 * (through the pages of a long dhikr first), OK counts, Play/Pause plays,
 * Down reaches the audio and Auto-advance chips. Back is the Router's.
 */
export function AdhkarReaderScreen({listId}: Props): React.ReactElement {
  const list = adhkarList(listId);
  const adhkar = useMemo(() => adhkarForList(listId), [listId]);
  const now = useNow();
  const pop = useNavStore(s => s.pop);

  const session = useAdhkarSessionStore(s => s.session);
  const audio = useAdhkarSessionStore(s => s.audio);
  const autoAdvance = useAdhkarSessionStore(s => s.autoAdvance);
  const {open, close, press, next, prev, restart, togglePlay, setAutoAdvance} =
    useAdhkarSessionStore.getState();

  useEffect(() => {
    open(
      listId,
      adhkar.map(d => d.repeatCount),
      adhkar.map(d => d.audioUrl),
    );
    return () => close();
  }, [listId, adhkar, open, close]);

  const ready = session !== null && session.listId === listId;
  const index = ready ? session.index : 0;
  const dhikr = adhkar[index];
  const finished = ready && session.finished;
  const pages = useMemo(
    () => (dhikr ? dhikrPages(dhikr.arabic, dhikr.translation) : []),
    [dhikr],
  );
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [index]);
  const shown = pages[Math.min(page, pages.length - 1)];

  // Arrows act on the dhikr only while the stage has focus; on the chips
  // they move between chips.
  const stageFocused = useRef(false);
  useEffect(() => {
    // The stage unmounts under the closing card without a blur.
    if (finished) stageFocused.current = false;
  }, [finished]);
  const pageRef = useRef({page, count: pages.length});
  pageRef.current = {page, count: pages.length};

  const remoteFilter = useMemo(createRemoteKeyFilter, []);
  const handleTVEvent = useCallback(
    (event: HWEvent): void => {
      const action = remoteFilter(event);
      if (!action) return;
      if (action === 'playPause') {
        togglePlay();
        return;
      }
      if (!stageFocused.current) return;
      const {page: p, count} = pageRef.current;
      if (action === 'right' || action === 'seekForward') {
        if (p < count - 1) setPage(p + 1);
        else next();
      } else if (p > 0) {
        setPage(p - 1);
      } else {
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

  return (
    <View style={styles.root}>
      <AdhkarGlow color={color} dim={finished ? 0.4 : 0} />

      <View style={styles.top} pointerEvents="none">
        <View style={styles.brand}>
          <LogoMark size={scale(34)} color={colors.text} />
          <Text style={styles.listTitle} numberOfLines={1}>
            {title}
          </Text>
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
          style={styles.stage}
          hasTVPreferredFocus
          onFocus={() => {
            stageFocused.current = true;
          }}
          onBlur={() => {
            stageFocused.current = false;
          }}
          onPress={press}
          accessibilityLabel={
            target > 1 ? `Count, ${count} of ${target}` : 'Next dhikr'
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
          <View style={styles.counter}>
            {target > 1 ? (
              <CountRing
                count={count}
                target={target}
                size={(shown?.arabicLength ?? 0) > 160 ? 120 : 156}
              />
            ) : (
              <Text style={styles.hint}>
                {count >= target ? 'Done' : 'Press OK when you have said it'}
              </Text>
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
        <View style={styles.chips}>
          <FocusableButton
            onPress={togglePlay}
            style={styles.chip}
            accessibilityLabel={playLabel(audio)}>
            <View style={styles.chipInner}>
              <FocusIcon
                icon={audio === 'playing' ? PauseIcon : PlayIcon}
                size={22}
              />
              <FocusText style={styles.chipText}>{playLabel(audio)}</FocusText>
            </View>
          </FocusableButton>
          <FocusableButton
            onPress={() => setAutoAdvance(!autoAdvance)}
            style={styles.chip}
            accessibilityLabel={`Auto-advance ${autoAdvance ? 'on' : 'off'}`}>
            {focused => (
              <View style={styles.chipInner}>
                {autoAdvance ? (
                  <CheckIcon
                    color={focused ? colors.onFocus : colors.accent}
                    size={scale(22)}
                  />
                ) : null}
                <FocusText
                  style={styles.chipText}
                  color={autoAdvance ? colors.text : colors.textSecondary}>
                  Auto-advance
                </FocusText>
              </View>
            )}
          </FocusableButton>
        </View>
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
  counter: {marginTop: 36, alignItems: 'center', justifyContent: 'center'},
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
  },
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
