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
  rangeForHafsKeys,
  type VerseRange,
} from '@/utils/playbackRangeSelection';
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

  // Long-presses on the page become the pick while this bar is up.
  useEffect(() => {
    const store = useMushafRangePickStore;
    store.getState().setConsumer(picked => {
      useMushafVerseSelectionStore.getState().clearSelection();
      const next = pickedRange(numbering, picked);
      if (!next) return;
      const state = store.getState();
      Haptics.selectionAsync().catch(() => undefined);
      if (state.step === 'first' || !state.range) {
        state.setRange(next, 'last');
        return;
      }
      // The second pick sets the end; before the start, it becomes the start.
      const {start, end} = state.range;
      const merged =
        compareVerseKeys(next.end, start) < 0
          ? {start: next.start, end}
          : {start, end: next.end};
      state.setRange(merged, 'last');
    });
    return () => {
      // Unmounting (pick ended or screen left): stop intercepting.
      store.getState().setConsumer(null);
    };
  }, [numbering]);

  // Leaving the mushaf mid-pick drops the pick.
  useEffect(
    () => () => {
      if (useMushafRangePickStore.getState().active) {
        useMushafRangePickStore.getState().end();
      }
    },
    [],
  );

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
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        {range ? (
          <Pressable
            onPress={() => useMushafRangePickStore.getState().redo()}
            accessibilityRole="button"
            hitSlop={8}
            style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
            <Text style={styles.ghostText}>{t('mushafPlayer.pickRedo')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            hitSlop={8}
            style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
            <Text style={styles.ghostText}>{t('mushafPlayer.pickCancel')}</Text>
          </Pressable>
        )}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingVertical: ms(10),
      paddingStart: ms(18),
      paddingEnd: ms(10),
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
    textBlock: {flex: 1, minWidth: 0},
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
