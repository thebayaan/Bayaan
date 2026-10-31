/**
 * MushafPlayerOptionsSheet - the Mushaf "Listen" sheet
 *
 * Reciter (hero), what to play (Page / Surah / Juz / Custom presets and the
 * range), repeat counters, speed and a floating Play button. "Custom" and
 * the range card open the verses page (mushaf-player/VersePicker), which can
 * also hand the choice to the page itself (store/mushafRangePickStore).
 */

// @ai-start
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, StyleSheet, useWindowDimensions} from 'react-native';
import {moderateScale as ms} from '@/utils/scale';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {SheetProps, ScrollView} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {
  useMushafPlayerStore,
  AvailableReciter,
} from '@/store/mushafPlayerStore';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {getReciterDisplayName, localizeDigits} from '@/i18n/format';
import {getDisplayLabelFromName} from '@/services/rewayah/RewayahIdentity';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {
  pickerDefaults,
  pickerPendingStart,
  pickerSelection,
  rangePickerNumbering,
} from '@/utils/playbackRangePicker';
import {
  countVerses,
  detectPreset,
  isKeyInRange,
  juzOfPage,
  orderedRange,
  pageOfKey,
  presetRange,
  surahIdOfKey,
  type RangeEnv,
  type RangePreset,
  type VerseRange,
} from '@/utils/playbackRangeSelection';
import {useMushafRangePickStore} from '@/store/mushafRangePickStore';
import {showSheet, hideSheet} from '@/components/sheets/sheetControl';
import {useNativeSheetId} from '@/components/native/nativeSheetContext';
import {getStyleLabel} from './sheetLabels';
import {useSheetBottomPadding} from './useSheetBottomPadding';
import {
  FloatingAction,
  FOOTER_SPACE,
  PresetTiles,
  RangeCard,
  ReciterHero,
  RepeatCounter,
  SectionTitle,
  SheetHeader,
  SpeedControl,
} from './mushaf-player/ListenParts';
import {VersePicker, type RangeTarget} from './mushaf-player/VersePicker';
import {
  endpointFigure,
  rangeLabel,
  surahNameOf,
} from './mushaf-player/rangeLabels';

const TABLET_MIN_WIDTH = 600;

function useRangeEnv(
  numbering: ReturnType<typeof rangePickerNumbering>,
): RangeEnv {
  return useMemo(
    () => ({
      numbering,
      hafsKeysOfPage: page =>
        mushafVerseMapService.getOrderedVerseKeysForPage(page),
      pageOfHafsKey: key => digitalKhattDataService.getPageForVerse(key),
    }),
    [numbering],
  );
}

export const MushafPlayerOptionsSheet = (
  props: SheetProps<'mushaf-player-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation('sheets');
  const insets = useSafeAreaInsets();
  const inNativeSheet = useNativeSheetId() !== null;
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const isWide = windowWidth >= TABLET_MIN_WIDTH;

  const currentPage = props.payload?.currentPage ?? 1;
  // Back from "pick on the page": its range and the settings kept meanwhile.
  const [returning] = useState(() => {
    if (!props.payload?.fromPick) return null;
    const {range, draft} = useMushafRangePickStore.getState();
    return {range, draft};
  });
  // The pick is over once the sheet is back (not during render).
  useEffect(() => {
    if (useMushafRangePickStore.getState().active) {
      useMushafRangePickStore.getState().end();
    }
  }, []);

  // Store
  const storeRewayatId = useMushafPlayerStore(s => s.rewayatId);
  const storeReciterName = useMushafPlayerStore(s => s.reciterName);
  const storeRate = useMushafPlayerStore(s => s.rate);
  const storeVerseRepeat = useMushafPlayerStore(s => s.verseRepeatCount);
  const storeRangeRepeat = useMushafPlayerStore(s => s.rangeRepeatCount);
  const availableReciters = useMushafPlayerStore(s => s.availableReciters);
  const playbackState = useMushafPlayerStore(s => s.playbackState);
  const currentUnitKeys = useMushafPlayerStore(s => s.currentUnitKeys);
  const currentVerseLabel = useMushafPlayerStore(s => s.currentVerseLabel);
  const storeRangeStart = useMushafPlayerStore(s => s.rangeStart);
  const storeRangeEnd = useMushafPlayerStore(s => s.rangeEnd);
  const storeRangeUnits = useMushafPlayerStore(s => s.rangeUnits);

  // The pickers offer the verses of the mushaf on screen, in its own
  // numbering once its verse units are ready (Hafs verses before that,
  // labelled as Hafs); a Hafs mushaf keeps Hafs keys.
  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const {units: mushafUnits} = useRewayahVerseUnits(
    mushafRewayah === 'hafs' ? null : mushafRewayah,
  );
  const numbering = useMemo(
    () => rangePickerNumbering(mushafRewayah, mushafUnits),
    [mushafRewayah, mushafUnits],
  );
  const env = useRangeEnv(numbering);

  const pageVerseKeys = useMemo(
    () => mushafVerseMapService.getOrderedVerseKeysForPage(currentPage),
    [currentPage],
  );
  const defaults = pickerDefaults(
    numbering,
    {
      rangeStart: storeRangeStart,
      rangeEnd: storeRangeEnd,
      rangeUnits: storeRangeUnits,
      pendingStartUnit: null,
      pendingStartVerseKey: null,
    },
    pageVerseKeys,
  );

  const initialRange = (): VerseRange => {
    if (returning?.range) return returning.range;
    const pending = pickerPendingStart(
      numbering,
      useMushafPlayerStore.getState(),
    );
    if (pending) {
      return orderedRange(
        pending,
        isKeyInRange(pending, defaults) ? defaults.end : pending,
      );
    }
    return {start: defaults.start, end: defaults.end};
  };

  // Local state, applied on Play (speed applies right away).
  const [range, setRange] = useState<VerseRange>(initialRange);
  const [preset, setPreset] = useState<RangePreset>(() =>
    detectPreset(env, range, currentPage),
  );
  const [selectedRewayatId, setSelectedRewayatId] = useState<string | null>(
    returning?.draft?.rewayatId ?? storeRewayatId,
  );
  const [selectedReciterName, setSelectedReciterName] = useState<string | null>(
    returning?.draft?.reciterName ?? storeReciterName,
  );
  const [verseRepeat, setVerseRepeat] = useState(
    returning?.draft?.verseRepeat ?? storeVerseRepeat,
  );
  const [rangeRepeat, setRangeRepeat] = useState(
    returning?.draft?.rangeRepeat ?? storeRangeRepeat,
  );
  const [view, setView] = useState<'main' | 'verses'>('main');
  const [target, setTarget] = useState<RangeTarget>('end');

  // The keys are in the pickers' numbering: when it changes (the mushaf's
  // verse units became ready while the sheet is open), start over from the
  // defaults in the new numbering.
  const numberingId = `${numbering.rewayah}@${numbering.units?.dataKey ?? ''}`;
  const [keysNumberingId, setKeysNumberingId] = useState(numberingId);
  useEffect(() => {
    if (numberingId === keysNumberingId) return;
    setKeysNumberingId(numberingId);
    const next = initialRange();
    setRange(next);
    setPreset(detectPreset(env, next, currentPage));
    // Only when the numbering changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberingId]);

  useEffect(() => {
    if (availableReciters.length === 0) {
      useMushafPlayerStore.getState().computeAvailableReciters();
    }
  }, [availableReciters.length]);

  const handleRateChange = useCallback((rate: number) => {
    useMushafPlayerStore.getState().setRate(rate);
  }, []);

  // Surah and juz presets follow the first verse of the range when it was
  // asked for (a verse's Play), else the page on screen.
  const anchorKey = useMemo(
    () =>
      pickerPendingStart(numbering, useMushafPlayerStore.getState()) ??
      (presetRange(env, 'page', currentPage, defaults.start)?.start ||
        defaults.start),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numbering, env, currentPage],
  );

  const handlePreset = useCallback(
    (next: RangePreset) => {
      if (next === 'custom') {
        setPreset('custom');
        setTarget('end');
        setView('verses');
        return;
      }
      const r = presetRange(env, next, currentPage, anchorKey);
      if (!r) return;
      setRange(r);
      setPreset(next);
    },
    [env, currentPage, anchorKey],
  );

  const handleRangeChange = useCallback(
    (next: VerseRange) => {
      setRange(next);
      setPreset(detectPreset(env, next, currentPage));
    },
    [env, currentPage],
  );

  // Reciter
  const handleOpenReciterPicker = useCallback(async () => {
    const reciter: AvailableReciter | undefined = await showSheet(
      'mushaf-reciter-picker',
      {payload: {selectedRewayatId}},
    );
    if (!reciter) return;
    setSelectedRewayatId(reciter.rewayatId);
    setSelectedReciterName(reciter.reciterName);
  }, [selectedRewayatId]);

  const selectedReciter = availableReciters.find(
    r => r.rewayatId === selectedRewayatId,
  );
  const reciterLabel = selectedReciter
    ? getReciterDisplayName({
        id: selectedReciter.reciterId,
        name: selectedReciter.reciterName,
      })
    : selectedReciterName;
  const reciterDetail = selectedReciter
    ? [
        getDisplayLabelFromName(selectedReciter.rewayahName),
        getStyleLabel(selectedReciter.style),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  // Playing
  const isActive = playbackState !== 'idle';
  const playingKey = currentUnitKeys[0] ?? null;
  const appliedRange = useMemo(
    () => ({start: defaults.start, end: defaults.end}),
    // The range Play applied last; it changes only with the store's range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeRangeStart, storeRangeEnd, storeRangeUnits, numberingId],
  );
  const progress =
    isActive && playingKey && isKeyInRange(playingKey, appliedRange)
      ? countVerses(numbering, {start: appliedRange.start, end: playingKey}) /
        Math.max(1, countVerses(numbering, appliedRange))
      : null;

  // Labels
  const count = countVerses(numbering, range);
  const crosses = surahIdOfKey(range.start) !== surahIdOfKey(range.end);
  const startSurah = surahNameOf(surahIdOfKey(range.start));
  const startPage = pageOfKey(env, range.start) ?? currentPage;
  const subtitle = (() => {
    switch (preset) {
      case 'page':
        return t('mushafPlayer.rangeSubtitlePage', {
          surah: startSurah,
          page: localizeDigits(currentPage),
        });
      case 'surah':
        return t('mushafPlayer.rangeSubtitleSurah', {surah: startSurah});
      case 'juz':
        return t('mushafPlayer.rangeSubtitleJuz', {
          juz: localizeDigits(juzOfPage(startPage)),
        });
      default:
        return crosses
          ? t('mushafPlayer.rangeSubtitleAcross', {
              from: startSurah,
              to: surahNameOf(surahIdOfKey(range.end)),
            })
          : t('mushafPlayer.rangeSubtitleCustom', {surah: startSurah});
    }
  })();
  const playTarget =
    preset === 'surah'
      ? startSurah
      : preset === 'juz'
        ? t('mushafPlayer.rangeSubtitleJuz', {
            juz: localizeDigits(juzOfPage(startPage)),
          })
        : rangeLabel(range);

  const word = (n: number) =>
    n === 0
      ? t('mushafPlayer.timesLoop')
      : n === 1
        ? t('mushafPlayer.timesOnce')
        : n === 2
          ? t('mushafPlayer.timesTwice')
          : t('mushafPlayer.timesMany', {times: localizeDigits(n)});
  const repeatText =
    verseRepeat === 1 && rangeRepeat === 1
      ? t('mushafPlayer.repeatStraight')
      : verseRepeat === 0
        ? t('mushafPlayer.repeatEachLoop')
        : t('mushafPlayer.repeatSentence', {
            verse: word(verseRepeat),
            range: word(rangeRepeat),
          });

  // Play
  const canPlay = !!selectedRewayatId && !!selectedReciterName;
  const handlePlay = useCallback(() => {
    if (!selectedRewayatId || !selectedReciterName) return;
    // Verse units of the mushaf's rewayah, or Hafs verses as before.
    const selection = pickerSelection(numbering, range.start, range.end);
    if (!selection) return;

    const store = useMushafPlayerStore.getState();
    store.stop();
    store.setReciter(selectedRewayatId, selectedReciterName);
    if (selection.kind === 'units') {
      store.setUnitRange(selection.first, selection.last);
    } else {
      store.setRange(selection.start, selection.end);
    }
    // Rate is bound to the store by the speed control.
    store.setVerseRepeatCount(verseRepeat);
    store.setRangeRepeatCount(rangeRepeat);
    store.startPlayback(
      currentPage,
      selection.kind === 'units' ? selection.first : range.start,
    );
    hideSheet('mushaf-player-options');
  }, [
    selectedRewayatId,
    selectedReciterName,
    range,
    verseRepeat,
    rangeRepeat,
    currentPage,
    numbering,
  ]);

  const handlePickOnPage = useCallback(() => {
    useMushafRangePickStore.getState().start(
      currentPage,
      {
        rewayatId: selectedRewayatId,
        reciterName: selectedReciterName,
        verseRepeat,
        rangeRepeat,
      },
      range,
    );
    hideSheet('mushaf-player-options');
  }, [
    currentPage,
    selectedRewayatId,
    selectedReciterName,
    verseRepeat,
    rangeRepeat,
    range,
  ]);

  // Native sheet: end the Play capsule where every sheet ends, at the home
  // indicator's inset and no further.
  const bottomInset = useSheetBottomPadding(insets.bottom + ms(12));
  const close = () => hideSheet('mushaf-player-options');

  const mainView = (
    <View style={inNativeSheet ? styles.fill : undefined}>
      {/* Pinned: the title and close stay put while the settings scroll. */}
      <SheetHeader title={t('mushafPlayer.listenTitle')} onClose={close} />
      <ScrollView
        style={[styles.scrollView, inNativeSheet && styles.scrollViewFill]}
        contentContainerStyle={[
          styles.container,
          {paddingBottom: FOOTER_SPACE + bottomInset},
        ]}
        showsVerticalScrollIndicator={false}
        bounces>
        <View style={styles.sections}>
          <ReciterHero
            name={reciterLabel}
            detail={reciterDetail}
            imageUrl={selectedReciter?.imageUrl ?? null}
            nowPlaying={
              isActive && currentVerseLabel
                ? t('mushafPlayer.nowPlayingVerse', {
                    verse: localizeDigits(currentVerseLabel),
                  })
                : null
            }
            progress={progress}
            compact={isWide}
            onChange={handleOpenReciterPicker}
          />
          <View>
            <SectionTitle>{t('mushafPlayer.whatToPlay')}</SectionTitle>
            <PresetTiles
              value={preset}
              onChange={handlePreset}
              compact={isWide}
            />
            <RangeCard
              subtitle={subtitle}
              from={endpointFigure(range.start, crosses)}
              to={endpointFigure(range.end, crosses)}
              count={count}
              onPress={() => {
                setTarget('end');
                setView('verses');
              }}
            />
          </View>
          <View>
            <SectionTitle>{t('mushafPlayer.repeatTitle')}</SectionTitle>
            <View style={styles.counters}>
              <RepeatCounter
                label={t('mushafPlayer.eachVerse')}
                value={verseRepeat}
                onChange={setVerseRepeat}
              />
              <RepeatCounter
                label={t('mushafPlayer.wholeRange')}
                value={rangeRepeat}
                onChange={setRangeRepeat}
              />
            </View>
            <View style={styles.repeatText}>
              <SectionTitle>{repeatText}</SectionTitle>
            </View>
          </View>
          <SpeedControl rate={storeRate} onChange={handleRateChange} />
        </View>
      </ScrollView>
      <FloatingAction
        label={
          isActive
            ? t('mushafPlayer.restartWithChanges')
            : t('mushafPlayer.playRange', {label: playTarget})
        }
        icon={isActive ? 'refresh' : 'play'}
        note={isActive ? t('mushafPlayer.speedLive') : null}
        disabled={!canPlay}
        bottomInset={bottomInset}
        onPress={handlePlay}
      />
    </View>
  );

  const versesView = (
    <View
      style={
        inNativeSheet
          ? styles.fill
          : {height: Math.min(windowHeight * 0.85, ms(760))}
      }>
      <VersePicker
        env={env}
        range={range}
        onChange={handleRangeChange}
        target={target}
        onTargetChange={setTarget}
        onBack={() => setView('main')}
        onDone={() => setView('main')}
        onPickOnPage={handlePickOnPage}
        bottomInset={bottomInset}
      />
    </View>
  );

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      // The verse grid scrolls: no drag-to-dismiss while it is open.
      gestureEnabled={view === 'main'}>
      {view === 'main' ? mainView : versesView}
    </ActionSheet>
  );
};

// @ai-end

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: ms(28),
      borderTopRightRadius: ms(28),
      paddingTop: ms(4),
      maxHeight: '85%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: ms(40),
      height: 2.5,
    },
    fill: {flex: 1},
    scrollView: {flexGrow: 0},
    scrollViewFill: {flexGrow: 1, flexShrink: 1},
    container: {},
    sections: {paddingHorizontal: ms(16), gap: ms(24), paddingTop: ms(4)},
    counters: {flexDirection: 'row', gap: ms(8)},
    repeatText: {marginTop: ms(10)},
  });
