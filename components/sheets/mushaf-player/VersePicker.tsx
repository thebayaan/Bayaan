// @ai-generated
/**
 * The verses page of the Mushaf Listen sheet. Four ways to the same range:
 * tap verse numbers (tap the first, then the last), read the opening of
 * each verse, type a reference ("2:255-257", "mulk 1-10", "juz 30"), or
 * pick on the page itself (onPickOnPage). Quick extends move the end.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView as RNScrollView,
  FlatList as RNFlatList,
  Keyboard,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import {FlatList} from 'react-native-actions-sheet';
import {Ionicons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {useTranslation} from 'react-i18next';
import {moderateScale as ms} from '@/utils/scale';
import {useTheme} from '@/hooks/useTheme';
import {SURAHS} from '@/data/surahData';
import {localizeDigits} from '@/i18n/format';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {RangePickerNumbering} from '@/utils/playbackRangePicker';
import {
  compareVerseKeys,
  countVerses,
  extendRange,
  isKeyInRange,
  parseRangeQuery,
  surahIdOfKey,
  type RangeEnv,
  type RangeExtend,
  type RangeSuggestion,
  type VerseRange,
} from '@/utils/playbackRangeSelection';
import {
  FloatingAction,
  FOOTER_SPACE,
  SheetHeader,
  useListenColors,
} from './ListenParts';
import {
  rangeLabel,
  surahNameOf,
  verseLabel,
  endpointFigure,
} from './rangeLabels';

export type RangeTarget = 'start' | 'end';

interface VersePickerProps {
  env: RangeEnv;
  range: VerseRange;
  onChange: (range: VerseRange) => void;
  target: RangeTarget;
  onTargetChange: (target: RangeTarget) => void;
  onBack: () => void;
  onDone: () => void;
  onPickOnPage: () => void;
  bottomInset: number;
}

const CELL = ms(46);

function verseCount(n: RangePickerNumbering, surah: number): number {
  if (n.units) return n.units.verseCount(surah);
  return SURAHS[surah - 1]?.verses_count ?? 1;
}

function verseText(n: RangePickerNumbering, key: string): string {
  if (n.units) {
    const unit = n.units.unitByKey(key);
    return unit ? n.units.unitText(unit) : '';
  }
  return digitalKhattDataService.tryGetVerseText(key, 'hafs') ?? '';
}

/** The tap rule: first tap sets the start, the next one the end. */
export function applyVerseTap(
  range: VerseRange,
  target: RangeTarget,
  key: string,
): {range: VerseRange; target: RangeTarget} {
  if (target === 'start') {
    const end = compareVerseKeys(key, range.end) > 0 ? key : range.end;
    return {range: {start: key, end}, target: 'end'};
  }
  // Before the start: the two swap rather than refusing the tap.
  if (compareVerseKeys(key, range.start) < 0) {
    return {range: {start: key, end: range.start}, target: 'start'};
  }
  return {range: {start: range.start, end: key}, target: 'start'};
}

export function VersePicker({
  env,
  range,
  onChange,
  target,
  onTargetChange,
  onBack,
  onDone,
  onPickOnPage,
  bottomInset,
}: VersePickerProps) {
  const {theme} = useTheme();
  const {t} = useTranslation('sheets');
  const c = useListenColors(theme);
  const n = env.numbering;
  const [mode, setMode] = useState<'numbers' | 'text'>('numbers');
  const [query, setQuery] = useState('');
  const [surah, setSurah] = useState(() =>
    surahIdOfKey(target === 'start' ? range.start : range.end),
  );
  const [width, setWidth] = useState(0);
  const pillsRef = useRef<RNFlatList<number>>(null);
  // The grid scrolls to this verse once its surah is shown and measured.
  const listRef = useRef<React.ComponentRef<typeof FlatList>>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollKey, setScrollKey] = useState<string | null>(() =>
    target === 'start' ? range.start : range.end,
  );

  const crosses = surahIdOfKey(range.start) !== surahIdOfKey(range.end);
  const count = countVerses(n, range);
  const suggestions = useMemo(
    () => (query.trim() ? parseRangeQuery(env, query) : []),
    [env, query],
  );

  const searching = query !== '';
  useEffect(() => {
    pillsRef.current?.scrollToIndex({
      index: surah - 1,
      animated: true,
      viewPosition: 0.3,
    });
    // Also when the pills come back after a search.
  }, [surah, searching]);

  const keys = useMemo(
    () =>
      Array.from({length: verseCount(n, surah)}, (_, i) => `${surah}:${i + 1}`),
    [n, surah],
  );

  const columns = Math.max(5, Math.floor((width || ms(340)) / CELL));
  const cellWidth = width ? width / columns : CELL;

  useEffect(() => {
    if (!scrollKey || !headerHeight || !width) return;
    if (surahIdOfKey(scrollKey) !== surah) return;
    const index = Number(scrollKey.split(':')[1]) - 1;
    const row = mode === 'numbers' ? Math.floor(index / columns) : index;
    const rowHeight = mode === 'numbers' ? CELL + ms(6) : ms(56);
    const offset = Math.max(0, headerHeight + (row - 1) * rowHeight);
    setScrollKey(null);
    // After the (re)mounted list has laid out its rows. Not cleared on
    // re-run: clearing scrollKey re-runs this effect straight away.
    setTimeout(
      () => listRef.current?.scrollToOffset({offset, animated: true}),
      80,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, headerHeight, width, surah, mode]);

  const tap = useCallback(
    (key: string) => {
      Haptics.selectionAsync();
      const next = applyVerseTap(range, target, key);
      onChange(next.range);
      onTargetChange(next.target);
    },
    [range, target, onChange, onTargetChange],
  );

  const focus = (which: RangeTarget) => {
    onTargetChange(which);
    const key = which === 'start' ? range.start : range.end;
    setSurah(surahIdOfKey(key));
    setScrollKey(key);
  };

  const extend = (kind: RangeExtend) => {
    const next = extendRange(env, range, kind);
    onChange(next);
    setSurah(surahIdOfKey(next.end));
    setScrollKey(next.end);
  };

  const applySuggestion = (s: RangeSuggestion) => {
    onChange(s.range);
    onTargetChange('start');
    setSurah(surahIdOfKey(s.range.start));
    setScrollKey(s.range.start);
    setQuery('');
    Keyboard.dismiss();
  };

  const renderCell = ({item, index}: {item: string; index: number}) => {
    const col = index % columns;
    const inRange = isKeyInRange(item, range);
    const isEnd = item === range.start || item === range.end;
    const left = item === range.start || col === 0;
    const right = item === range.end || col === columns - 1;
    const r = CELL / 2;
    return (
      <View
        style={[
          styles.cellWrap,
          {width: cellWidth},
          inRange && {
            backgroundColor: c.band,
            borderTopLeftRadius: left ? r : 0,
            borderBottomLeftRadius: left ? r : 0,
            borderTopRightRadius: right ? r : 0,
            borderBottomRightRadius: right ? r : 0,
          },
        ]}>
        <Pressable
          onPress={() => tap(item)}
          accessibilityRole="button"
          accessibilityLabel={verseLabel(item)}
          accessibilityState={{selected: inRange}}
          style={({pressed}) => [
            styles.cell,
            isEnd && {backgroundColor: c.text},
            pressed && !isEnd && {backgroundColor: c.cardPressed},
          ]}>
          <Text
            style={[
              styles.cellText,
              {color: isEnd ? theme.colors.background : c.text},
              !inRange && {opacity: 0.75},
            ]}>
            {localizeDigits(item.split(':')[1])}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderTextRow = ({item}: {item: string}) => {
    const inRange = isKeyInRange(item, range);
    const isEnd = item === range.start || item === range.end;
    return (
      <Pressable
        onPress={() => tap(item)}
        accessibilityRole="button"
        accessibilityLabel={verseLabel(item)}
        accessibilityState={{selected: inRange}}
        style={({pressed}) => [
          styles.textRow,
          inRange && {backgroundColor: c.band},
          pressed && {backgroundColor: c.cardPressed},
        ]}>
        <View
          style={[
            styles.textNumber,
            {backgroundColor: isEnd ? c.text : theme.colors.background},
          ]}>
          <Text
            style={[
              styles.textNumberLabel,
              {color: isEnd ? theme.colors.background : c.text},
            ]}>
            {localizeDigits(item.split(':')[1])}
          </Text>
        </View>
        <Text style={[styles.verseText, {color: c.text}]} numberOfLines={1}>
          {verseText(n, item)}
        </Text>
      </Pressable>
    );
  };

  const endpoint = (which: RangeTarget) => {
    const key = which === 'start' ? range.start : range.end;
    const active = target === which;
    return (
      <Pressable
        onPress={() => focus(which)}
        accessibilityRole="button"
        accessibilityState={{selected: active}}
        style={[
          styles.endpoint,
          {backgroundColor: c.card},
          active && {borderColor: c.text},
        ]}>
        <Text style={[styles.caption, {color: c.secondary}]}>
          {which === 'start' ? t('mushafPlayer.from') : t('mushafPlayer.to')}
        </Text>
        <View style={styles.endpointRow}>
          <Text style={[styles.endpointNumber, {color: c.text}]}>
            {endpointFigure(key, crosses)}
          </Text>
          <Text
            style={[styles.endpointSurah, {color: c.secondary}]}
            numberOfLines={1}>
            {surahNameOf(surahIdOfKey(key))}
          </Text>
        </View>
      </Pressable>
    );
  };

  const suggestionText = (s: RangeSuggestion) => {
    switch (s.kind) {
      case 'verse':
        return t('mushafPlayer.suggestVerse', {
          label: verseLabel(s.range.start),
        });
      case 'toEndOfSurah':
        return t('mushafPlayer.suggestToEnd', {
          label: verseLabel(s.range.start),
          surah: surahNameOf(surahIdOfKey(s.range.start)),
        });
      case 'page':
        return t('mushafPlayer.suggestPage', {
          page: localizeDigits(s.number ?? 0),
        });
      case 'juz':
        return t('mushafPlayer.suggestJuz', {
          juz: localizeDigits(s.number ?? 0),
        });
      case 'surah':
        return t('mushafPlayer.suggestSurah', {
          surah: surahNameOf(surahIdOfKey(s.range.start)),
        });
      default:
        return rangeLabel(s.range);
    }
  };

  // Pinned above the list: re-rendering the list never remounts the search
  // field, so typing keeps the keyboard.
  const pinned = (
    <View>
      <SheetHeader
        title={t('mushafPlayer.editRange')}
        onBack={onBack}
        trailing={
          <Pressable
            onPress={onPickOnPage}
            accessibilityRole="button"
            accessibilityLabel={t('mushafPlayer.pickOnPage')}
            hitSlop={8}
            style={[styles.iconButton, {backgroundColor: c.chip}]}>
            <Ionicons name="hand-left-outline" size={ms(17)} color={c.text} />
          </Pressable>
        }
      />
      <View style={styles.body}>
        <View style={styles.endpoints}>
          {endpoint('start')}
          {endpoint('end')}
        </View>
        <View style={styles.searchRow}>
          <View style={[styles.search, {backgroundColor: c.chip}]}>
            <Ionicons name="search" size={ms(15)} color={c.secondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('mushafPlayer.searchVerses')}
              placeholderTextColor={c.faint}
              style={[styles.searchInput, {color: c.text}]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              keyboardAppearance={theme.isDarkMode ? 'dark' : 'light'}
              accessibilityLabel={t('mushafPlayer.searchVerses')}
            />
            {!!query && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button">
                <Ionicons name="close-circle" size={ms(17)} color={c.faint} />
              </Pressable>
            )}
          </View>
          {!query && (
            <View style={[styles.segment, {backgroundColor: c.chip}]}>
              {(['numbers', 'text'] as const).map(m => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{selected: mode === m}}
                  style={[
                    styles.segmentItem,
                    mode === m && {backgroundColor: theme.colors.background},
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      {color: mode === m ? c.text : c.faint},
                    ]}>
                    {m === 'numbers'
                      ? t('mushafPlayer.modeNumbers')
                      : t('mushafPlayer.modeText')}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        {!query && (
          <>
            <RNScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled">
              {(
                [
                  ['plus5', t('mushafPlayer.extendPlus5')],
                  ['page', t('mushafPlayer.extendPage')],
                  ['surah', t('mushafPlayer.extendSurah')],
                  ['juz', t('mushafPlayer.extendJuz')],
                ] as const
              ).map(([kind, label]) => (
                <Pressable
                  key={kind}
                  onPress={() => extend(kind)}
                  accessibilityRole="button"
                  style={({pressed}) => [
                    styles.chip,
                    {borderColor: c.divider},
                    pressed && {backgroundColor: c.cardPressed},
                  ]}>
                  <Text style={[styles.chipText, {color: c.text}]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </RNScrollView>
            <RNFlatList
              ref={pillsRef}
              horizontal
              data={SURAHS.map(s => s.id)}
              keyExtractor={id => String(id)}
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
              contentContainerStyle={styles.chips}
              initialNumToRender={SURAHS.length}
              onScrollToIndexFailed={info =>
                setTimeout(
                  () =>
                    pillsRef.current?.scrollToIndex({
                      index: info.index,
                      animated: false,
                      viewPosition: 0.3,
                    }),
                  100,
                )
              }
              keyboardShouldPersistTaps="handled"
              renderItem={({item}) => {
                const on = item === surah;
                return (
                  <Pressable
                    onPress={() => setSurah(item)}
                    accessibilityRole="button"
                    accessibilityState={{selected: on}}
                    style={[
                      styles.surahPill,
                      {backgroundColor: on ? c.text : c.chip},
                    ]}>
                    <Text
                      style={[
                        styles.surahPillNumber,
                        {color: on ? theme.colors.background : c.faint},
                      ]}>
                      {localizeDigits(item)}
                    </Text>
                    <Text
                      style={[
                        styles.chipText,
                        {color: on ? theme.colors.background : c.text},
                      ]}>
                      {surahNameOf(item)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </>
        )}
      </View>
    </View>
  );

  // Scrolls with the grid: only the caption, so the chips stay in view
  // when the grid jumps to the range.
  const listHeader = (
    <View onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
      <View style={styles.listBody}>
        <View style={styles.listHeader}>
          <Text style={[styles.caption, {color: c.secondary}]}>
            {surahNameOf(surah)} ·{' '}
            {t('mushafPlayer.verseCount', {
              count: verseCount(n, surah),
            })}
            {n.hafsFallback ? ` · ${t('mushafPlayer.hafsNumbers')}` : ''}
          </Text>
          <Text style={[styles.caption, {color: c.secondary}]}>
            {target === 'start'
              ? t('mushafPlayer.tapFirst')
              : t('mushafPlayer.tapLast')}
          </Text>
        </View>
      </View>
    </View>
  );

  const suggestionsView = (
    <View style={styles.body}>
      {suggestions.length === 0 ? (
        <Text style={[styles.empty, {color: c.secondary}]}>
          {t('mushafPlayer.noMatches')}
        </Text>
      ) : (
        <View style={styles.suggestions}>
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.kind}-${s.range.start}-${s.range.end}`}
              onPress={() => applySuggestion(s)}
              accessibilityRole="button"
              style={({pressed}) => [
                i === 0 ? styles.topSuggestion : styles.suggestion,
                {
                  backgroundColor:
                    i === 0 ? c.text : pressed ? c.cardPressed : c.card,
                },
              ]}>
              <View style={styles.suggestionMain}>
                <Text
                  style={[
                    i === 0 ? styles.topTitle : styles.suggestionTitle,
                    {color: i === 0 ? theme.colors.background : c.text},
                  ]}
                  numberOfLines={2}>
                  {suggestionText(s)}
                </Text>
                <Text
                  style={[
                    styles.caption,
                    {
                      color: i === 0 ? theme.colors.background : c.secondary,
                      opacity: i === 0 ? 0.75 : 1,
                    },
                  ]}>
                  {s.kind === 'range' || s.kind === 'verse'
                    ? t('mushafPlayer.verseCount', {
                        count: countVerses(n, s.range),
                      })
                    : `${rangeLabel(s.range)} · ${t('mushafPlayer.verseCount', {
                        count: countVerses(n, s.range),
                      })}`}
                </Text>
              </View>
              {i === 0 && (
                <View
                  style={[
                    styles.useBadge,
                    {backgroundColor: theme.colors.background},
                  ]}>
                  <Text style={[styles.chipText, {color: c.text}]}>
                    {t('mushafPlayer.suggestUse')}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.fill}>
      {pinned}
      {query ? (
        <RNScrollView
          style={styles.fill}
          contentContainerStyle={{paddingBottom: bottomInset + ms(16)}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {suggestionsView}
        </RNScrollView>
      ) : (
        <FlatList
          ref={listRef}
          key={`${mode}-${columns}`}
          data={keys}
          numColumns={mode === 'numbers' ? columns : 1}
          keyExtractor={item => item}
          renderItem={mode === 'numbers' ? renderCell : renderTextRow}
          ListHeaderComponent={listHeader}
          style={styles.fill}
          contentContainerStyle={{paddingBottom: FOOTER_SPACE + bottomInset}}
          columnWrapperStyle={mode === 'numbers' ? styles.gridRow : undefined}
          onLayout={(e: LayoutChangeEvent) =>
            setWidth(e.nativeEvent.layout.width - 2 * ms(16))
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={60}
          showsVerticalScrollIndicator={false}
        />
      )}
      {/* While typing, a suggestion is the action; the footer would cover
          the suggestions above the keyboard. */}
      {!query && (
        <FloatingAction
          label={t('mushafPlayer.useVerses', {count})}
          icon={null}
          bottomInset={bottomInset}
          onPress={onDone}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  body: {paddingHorizontal: ms(16), paddingTop: ms(10)},
  iconButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpoints: {flexDirection: 'row', gap: ms(8)},
  endpoint: {
    flex: 1,
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
    borderRadius: ms(20),
    borderWidth: ms(3),
    borderColor: 'transparent',
  },
  endpointRow: {flexDirection: 'row', alignItems: 'baseline', gap: ms(6)},
  endpointNumber: {
    fontSize: ms(26),
    fontFamily: 'Manrope-ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  endpointSurah: {
    flexShrink: 1,
    fontSize: ms(13),
    fontFamily: 'Manrope-SemiBold',
  },
  caption: {fontSize: ms(12), fontFamily: 'Manrope-Bold'},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: ms(12),
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    height: ms(42),
    borderRadius: ms(21),
    paddingHorizontal: ms(14),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(15),
    fontFamily: 'Manrope-SemiBold',
    paddingVertical: 0,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: ms(18),
    padding: ms(3),
    gap: ms(2),
  },
  segmentItem: {
    height: ms(34),
    paddingHorizontal: ms(12),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {fontSize: ms(13), fontFamily: 'Manrope-Bold'},
  bleed: {marginHorizontal: -ms(16), marginTop: ms(10)},
  chips: {paddingHorizontal: ms(16), gap: ms(6)},
  chip: {
    height: ms(34),
    paddingHorizontal: ms(13),
    borderRadius: ms(17),
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  chipText: {fontSize: ms(13), fontFamily: 'Manrope-Bold'},
  surahPill: {
    height: ms(36),
    paddingHorizontal: ms(14),
    borderRadius: ms(18),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
  },
  surahPillNumber: {fontSize: ms(12), fontFamily: 'Manrope-Bold'},
  listBody: {paddingHorizontal: ms(16)},
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ms(16),
    marginBottom: ms(6),
    marginHorizontal: ms(4),
  },
  gridRow: {paddingHorizontal: ms(16)},
  cellWrap: {
    height: CELL,
    marginVertical: ms(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    width: CELL - ms(6),
    height: CELL - ms(6),
    borderRadius: (CELL - ms(6)) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: ms(14),
    fontFamily: 'Manrope-Bold',
    fontVariant: ['tabular-nums'],
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    marginHorizontal: ms(16),
    paddingHorizontal: ms(12),
    height: ms(56),
  },
  textNumber: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textNumberLabel: {
    fontSize: ms(13),
    fontFamily: 'Manrope-ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  verseText: {
    flex: 1,
    fontFamily: 'Uthmani',
    fontSize: ms(19),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  suggestions: {gap: ms(8), marginTop: ms(16)},
  topSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    padding: ms(16),
    borderRadius: ms(22),
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(12),
    paddingHorizontal: ms(16),
    borderRadius: ms(18),
  },
  suggestionMain: {flex: 1, gap: ms(3)},
  topTitle: {fontSize: ms(18), fontFamily: 'Manrope-ExtraBold'},
  suggestionTitle: {fontSize: ms(15), fontFamily: 'Manrope-Bold'},
  useBadge: {
    height: ms(36),
    paddingHorizontal: ms(16),
    borderRadius: ms(18),
    justifyContent: 'center',
  },
  empty: {
    marginTop: ms(24),
    textAlign: 'center',
    fontSize: ms(14),
    fontFamily: 'Manrope-Medium',
    lineHeight: ms(20),
  },
});
