// @ai-generated
/**
 * "Pick on the page" for the Mushaf Listen sheet. While a pick is active
 * the sheet is closed and this bar floats over the mushaf: the reader
 * long-presses (or drags across) the first verse, then the last one, and
 * "Use" reopens the sheet with that range. The long-press selection reaches
 * us through showVerseActions' consumer instead of the verse actions sheet.
 */

import React, {useEffect, useMemo} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {moderateScale as ms} from '@/utils/scale';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useRewayahVerseUnits} from '@/hooks/useRewayahVerseUnits';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  useMushafRangePickStore,
  type PickedVerses,
} from '@/store/mushafRangePickStore';
import {
  rangePickerNumbering,
  type RangePickerNumbering,
} from '@/utils/playbackRangePicker';
import {
  compareVerseKeys,
  countVerses,
  isKeyInRange,
  pageOfKey,
  rangeForHafsKeys,
  type RangeEnv,
  type VerseRange,
} from '@/utils/playbackRangeSelection';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import {showSheet} from '@/components/sheets/sheetControl';
import {rangeLabel} from '@/components/sheets/mushaf-player/rangeLabels';

/** The picked verses as a range in the pickers' numbering. */
function pickedRange(
  n: RangePickerNumbering,
  picked: PickedVerses,
): VerseRange | null {
  if (n.units && picked.rewayah === n.rewayah && picked.unitKeys?.length) {
    const keys = [...picked.unitKeys].sort(compareVerseKeys);
    return {start: keys[0], end: keys[keys.length - 1]};
  }
  const hafs = [...(picked.verseKeys ?? [picked.verseKey])].sort(
    compareVerseKeys,
  );
  return rangeForHafsKeys(n, hafs);
}

/** Shows `range` as the page's verse selection, where it falls on `page`. */
function highlightOnPage(
  n: RangePickerNumbering,
  range: VerseRange | null,
  page: number | null,
): void {
  const selection = useMushafVerseSelectionStore.getState();
  const keys =
    range && page
      ? mushafVerseMapService.getOrderedVerseKeysForPage(page).filter(key => {
          const unit = rangeForHafsKeys(n, [key]);
          return !!unit && isKeyInRange(unit.start, range);
        })
      : [];
  if (keys.length > 0 && page) selection.selectVerseRange(keys, page);
  else selection.clearSelection();
}

export function RangePickBar() {
  const active = useMushafRangePickStore(s => s.active);
  if (!active) return null;
  return <ActiveRangePickBar />;
}

function ActiveRangePickBar() {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation('sheets');
  const insets = useSafeAreaInsets();
  const range = useMushafRangePickStore(s => s.range);
  const step = useMushafRangePickStore(s => s.step);
  const page = useMushafRangePickStore(s => s.page);

  const mushafRewayah = useMushafSettingsStore(s => s.rewayah);
  const {units} = useRewayahVerseUnits(
    mushafRewayah === 'hafs' ? null : mushafRewayah,
  );
  const numbering = useMemo(
    () => rangePickerNumbering(mushafRewayah, units),
    [mushafRewayah, units],
  );

  // Long-presses and taps on the page become the pick while this bar is up;
  // the picked verses stay highlighted on the page.
  useEffect(() => {
    const store = useMushafRangePickStore;
    store.getState().setConsumer(picked => {
      const page =
        useMushafVerseSelectionStore.getState().selectedPageNumber ?? null;
      const next = pickedRange(numbering, picked);
      if (!next) {
        useMushafVerseSelectionStore.getState().clearSelection();
        return;
      }
      const state = store.getState();
      Haptics.selectionAsync().catch(() => undefined);
      if (state.step === 'first' || !state.range) {
        state.setRange(next, 'last');
        highlightOnPage(numbering, next, page);
        return;
      }
      // The second pick sets the end; before the start, it becomes the start.
      const {start, end} = state.range;
      const merged =
        compareVerseKeys(next.end, start) < 0
          ? {start: next.start, end}
          : {start, end: next.end};
      state.setRange(merged, 'last');
      highlightOnPage(numbering, merged, page);
    });
    return () => {
      // Unmounting (pick ended or screen left): stop intercepting.
      store.getState().setConsumer(null);
    };
  }, [numbering]);

  // Open on the range being edited: turn to its first page, or show it on
  // this one.
  useEffect(() => {
    const {range: current, page: shown} = useMushafRangePickStore.getState();
    if (!current) return;
    const env: RangeEnv = {
      numbering,
      hafsKeysOfPage: p => mushafVerseMapService.getOrderedVerseKeysForPage(p),
      pageOfHafsKey: key => digitalKhattDataService.getPageForVerse(key),
    };
    const target = pageOfKey(env, current.start);
    if (target && target !== shown) {
      const hafsKey = numbering.units
        ? numbering.units.unitByKey(current.start)?.hafsKeys[0]
        : current.start;
      if (hafsKey) {
        useMushafNavigationStore.getState().navigateToVerse(hafsKey, target);
      }
    } else {
      highlightOnPage(numbering, current, shown);
    }
    // Once, when the pick starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the mushaf mid-pick drops the pick and its highlight.
  useEffect(
    () => () => {
      useMushafVerseSelectionStore.getState().clearSelection();
      if (useMushafRangePickStore.getState().active) {
        useMushafRangePickStore.getState().end();
      }
    },
    [],
  );

  const handleRedo = () => {
    useMushafRangePickStore.getState().redo();
    useMushafVerseSelectionStore.getState().clearSelection();
  };

  const reopen = () =>
    showSheet('mushaf-player-options', {
      payload: {currentPage: page, fromPick: true},
    }).catch(() => undefined);

  const handleUse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    reopen();
  };

  // Cancel keeps the reciter and repeats but not the picked range.
  const handleCancel = () => {
    useMushafRangePickStore.setState({range: null});
    reopen();
  };

  const count = range ? countVerses(numbering, range) : 0;
  const title = !range
    ? t('mushafPlayer.pickFirst')
    : step === 'last' && range.start === range.end
      ? t('mushafPlayer.pickLast')
      : rangeLabel(range);
  const detail = range
    ? range.start === range.end
      ? t('mushafPlayer.pickHint')
      : t('mushafPlayer.verseCount', {count})
    : t('mushafPlayer.pickHint');

  // Above the native toolbar (glass) or the player bar.
  const bottom = insets.bottom + (USE_GLASS ? ms(64) : ms(72));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, {bottom}]}>
      <View style={styles.bar} accessibilityLiveRegion="polite">
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.detail} numberOfLines={2}>
            {detail}
          </Text>
        </View>
        <View style={styles.actions}>
          {range ? (
            <Pressable
              onPress={handleRedo}
              accessibilityRole="button"
              hitSlop={8}
              style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
              <Text style={styles.ghostText}>{t('mushafPlayer.pickRedo')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            hitSlop={8}
            style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
            <Text style={styles.ghostText}>{t('mushafPlayer.pickCancel')}</Text>
          </Pressable>
          <View style={styles.spacer} />
          <Pressable
            onPress={handleUse}
            disabled={!range}
            accessibilityRole="button"
            accessibilityState={{disabled: !range}}
            style={({pressed}) => [
              styles.primary,
              !range && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryText}>{t('mushafPlayer.pickUse')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: ms(12),
      right: ms(12),
      alignItems: 'center',
      zIndex: 50,
    },
    bar: {
      width: '100%',
      maxWidth: ms(520),
      gap: ms(12),
      paddingTop: ms(14),
      paddingBottom: ms(10),
      paddingHorizontal: ms(10),
      borderRadius: ms(28),
      backgroundColor: theme.colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.12).toString(),
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: {width: 0, height: 6},
      elevation: 8,
    },
    textBlock: {paddingHorizontal: ms(8)},
    actions: {flexDirection: 'row', alignItems: 'center', gap: ms(8)},
    spacer: {flex: 1},
    title: {
      fontFamily: 'Manrope-Bold',
      fontSize: ms(15),
      color: theme.colors.text,
    },
    detail: {
      fontFamily: 'Manrope-Medium',
      fontSize: ms(12),
      marginTop: ms(2),
      color: Color(theme.colors.textSecondary).alpha(0.85).toString(),
    },
    ghost: {
      paddingHorizontal: ms(12),
      height: ms(40),
      borderRadius: ms(20),
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    ghostText: {
      fontFamily: 'Manrope-SemiBold',
      fontSize: ms(14),
      color: theme.colors.text,
    },
    primary: {
      paddingHorizontal: ms(18),
      height: ms(40),
      borderRadius: ms(20),
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
    primaryText: {
      fontFamily: 'Manrope-Bold',
      fontSize: ms(14),
      color: theme.colors.background,
    },
    disabled: {opacity: 0.35},
    pressed: {opacity: 0.7},
  });
