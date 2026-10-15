import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale as ms} from 'react-native-size-matters';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {SURAHS} from '@/data/surahData';
import Color from 'color';
// @ai-start
import {useTranslation} from 'react-i18next';
import i18n from '@/i18n';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
// @ai-end

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// @ai-start
const REPEAT_VALUES = [1, 2, 3, 0];
// @ai-end

// @ai-start
function getRepeatLabel(value: number): string {
  return value === 0
    ? i18n.t('sheets:repeat.loop')
    : i18n.t('sheets:repeat.times', {count: value});
}
// @ai-end

// @ai-start
export const MushafRepeatOptionsSheet = (
  props: SheetProps<'mushaf-repeat-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const {t} = useTranslation('sheets');

  const verseKey = props.payload?.verseKey ?? '';
  const verseKeys = props.payload?.verseKeys;
  const page = props.payload?.page ?? 1;

  const surahNumber = props.payload?.surahNumber ?? 1;
  const initialAyah = useMemo(
    () => parseInt(verseKey.split(':')[1], 10) || 1,
    [verseKey],
  );

  const surahInfo = SURAHS[surahNumber - 1];
  const totalVerses = surahInfo?.verses_count ?? 1;

  const [initialFrom, initialTo] = useMemo(() => {
    if (verseKeys && verseKeys.length > 1) {
      const firstA = parseInt(verseKeys[0].split(':')[1], 10);
      const lastA = parseInt(verseKeys[verseKeys.length - 1].split(':')[1], 10);
      return [firstA, lastA];
    }
    return [initialAyah, initialAyah];
  }, [verseKeys, initialAyah]);

  const storeRate = useMushafPlayerStore(s => s.rate);

  const [rate, setRate] = useState(storeRate);
  const [verseRepeat, setVerseRepeat] = useState(2);
  const [rangeRepeat, setRangeRepeat] = useState(1);
  const [fromAyah, setFromAyah] = useState(initialFrom);
  const [toAyah, setToAyah] = useState(initialTo);

  const handleFromChange = useCallback(
    (delta: number) => {
      setFromAyah(prev => Math.max(1, Math.min(toAyah, prev + delta)));
    },
    [toAyah],
  );

  const handleToChange = useCallback(
    (delta: number) => {
      setToAyah(prev =>
        Math.max(fromAyah, Math.min(totalVerses, prev + delta)),
      );
    },
    [fromAyah, totalVerses],
  );

  const verseRefText = useMemo(() => {
    const surahName = surahInfo ? getSurahDisplayName(surahInfo) : '';
    if (fromAyah === toAyah) {
      return `${surahName} ${localizeDigits(`${surahNumber}:${fromAyah}`)}`;
    }
    return `${surahName} ${localizeDigits(
      `${surahNumber}:${fromAyah}-${toAyah}`,
    )}`;
  }, [surahInfo, surahNumber, fromAyah, toAyah]);

  const handleRateChange = useCallback((newRate: number) => {
    setRate(newRate);
    useMushafPlayerStore.getState().setRate(newRate);
  }, []);

  const handleStart = useCallback(() => {
    const store = useMushafPlayerStore.getState();

    store.setRange(
      {surah: surahNumber, ayah: fromAyah},
      {surah: surahNumber, ayah: toAyah},
    );
    store.setRate(rate);
    store.setVerseRepeatCount(verseRepeat);
    store.setRangeRepeatCount(rangeRepeat);

    const firstKey = `${surahNumber}:${fromAyah}`;
    SheetManager.hide('mushaf-repeat-options');
    store.startPlayback(page, firstKey);
  }, [surahNumber, fromAyah, toAyah, rate, verseRepeat, rangeRepeat, page]);

  if (!props.payload) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('repeat.title')}</Text>
        <Text style={styles.subtitle}>{verseRefText}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('repeat.verseRange')}</Text>
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>{t('repeat.from')}</Text>
            <View style={styles.stepperContainer}>
              <Pressable
                style={[
                  styles.stepperButton,
                  fromAyah <= 1 && styles.stepperButtonDisabled,
                ]}
                onPress={() => handleFromChange(-1)}
                disabled={fromAyah <= 1}>
                <Ionicons
                  name="remove"
                  size={ms(16)}
                  color={
                    fromAyah <= 1
                      ? Color(theme.colors.text).alpha(0.2).toString()
                      : theme.colors.text
                  }
                />
              </Pressable>
              <Text style={styles.stepperValue}>
                {localizeDigits(fromAyah)}
              </Text>
              <Pressable
                style={[
                  styles.stepperButton,
                  fromAyah >= toAyah && styles.stepperButtonDisabled,
                ]}
                onPress={() => handleFromChange(1)}
                disabled={fromAyah >= toAyah}>
                <Ionicons
                  name="add"
                  size={ms(16)}
                  color={
                    fromAyah >= toAyah
                      ? Color(theme.colors.text).alpha(0.2).toString()
                      : theme.colors.text
                  }
                />
              </Pressable>
            </View>
          </View>
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>{t('repeat.to')}</Text>
            <View style={styles.stepperContainer}>
              <Pressable
                style={[
                  styles.stepperButton,
                  toAyah <= fromAyah && styles.stepperButtonDisabled,
                ]}
                onPress={() => handleToChange(-1)}
                disabled={toAyah <= fromAyah}>
                <Ionicons
                  name="remove"
                  size={ms(16)}
                  color={
                    toAyah <= fromAyah
                      ? Color(theme.colors.text).alpha(0.2).toString()
                      : theme.colors.text
                  }
                />
              </Pressable>
              <Text style={styles.stepperValue}>{localizeDigits(toAyah)}</Text>
              <Pressable
                style={[
                  styles.stepperButton,
                  toAyah >= totalVerses && styles.stepperButtonDisabled,
                ]}
                onPress={() => handleToChange(1)}
                disabled={toAyah >= totalVerses}>
                <Ionicons
                  name="add"
                  size={ms(16)}
                  color={
                    toAyah >= totalVerses
                      ? Color(theme.colors.text).alpha(0.2).toString()
                      : theme.colors.text
                  }
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('repeat.playSpeed')}</Text>
          <View style={styles.chipRowFlex}>
            {SPEEDS.map(speed => {
              const isActive = rate === speed;
              return (
                <Pressable
                  key={speed}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => handleRateChange(speed)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {t('playbackSpeed.speed', {speed})}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('repeat.eachVerse')}</Text>
          <View style={styles.chipRowFlex}>
            {REPEAT_VALUES.map(value => {
              const isActive = verseRepeat === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => setVerseRepeat(value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {getRepeatLabel(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('repeat.range')}</Text>
          <View style={styles.chipRowFlex}>
            {REPEAT_VALUES.map(value => {
              const isActive = rangeRepeat === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => setRangeRepeat(value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {getRepeatLabel(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View
        style={[styles.stickyFooter, {paddingBottom: insets.bottom + ms(4)}]}>
        <Pressable style={styles.playButton} onPress={handleStart}>
          <Ionicons name="play" size={ms(18)} color={theme.colors.background} />
          <Text style={styles.playButtonText}>{t('repeat.start')}</Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: ms(20),
      borderTopRightRadius: ms(20),
      paddingTop: ms(8),
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
    container: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
    },
    title: {
      fontSize: ms(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: ms(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: ms(4),
      marginBottom: ms(20),
    },
    section: {
      marginBottom: ms(20),
    },
    sectionLabel: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      marginBottom: ms(10),
    },
    chipRowFlex: {
      flexDirection: 'row',
      gap: ms(8),
    },
    chipFlex: {
      flex: 1,
      paddingVertical: ms(8),
      borderRadius: ms(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      alignItems: 'center',
    },
    chipActive: {
      backgroundColor: theme.colors.text,
    },
    chipText: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    chipTextActive: {
      color: theme.colors.background,
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ms(8),
    },
    rangeLabel: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(12),
    },
    stepperButton: {
      width: ms(32),
      height: ms(32),
      borderRadius: ms(16),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonDisabled: {
      opacity: 0.5,
    },
    stepperValue: {
      fontSize: ms(15),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      minWidth: ms(28),
      textAlign: 'center',
    },
    stickyFooter: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ms(52),
      borderRadius: ms(14),
      backgroundColor: theme.colors.text,
      gap: ms(8),
    },
    playButtonText: {
      fontSize: ms(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.background,
    },
  });
