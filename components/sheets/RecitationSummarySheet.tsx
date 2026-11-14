import React, {useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {SURAHS} from '@/data/surahData';
import {useTheme} from '@/hooks/useTheme';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import type {FlagKind, ShownFlag} from '@/services/recitation/flags';
import {recitationLogDatabase} from '@/services/recitation/RecitationLogDatabase';
import {useMushafNavigationStore} from '@/store/mushafNavigationStore';
import type {
  RecitationSummary,
  RecitationSummaryMark,
} from '@/store/recitationTrackingStore';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {recitationMarkRef} from './recitationMarkRef';

// After a take: the ayat recited, the words marked while reciting (and the
// ones corrected), and the possible slips worth checking, each with Show and
// Retry. Wording is always "may have"; tajweed and harakat are left to a
// teacher.

const KIND_KEYS = {
  skippedAyah: 'recitationSummary.kinds.skippedAyah',
  skippedWord: 'recitationSummary.kinds.skippedWord',
  similarAyah: 'recitationSummary.kinds.similarAyah',
  differentWord: 'recitationSummary.kinds.differentWord',
} as const satisfies Record<FlagKind, string>;

const MARK_KEYS = {
  missed: 'recitationSummary.markKinds.missed',
  wrong: 'recitationSummary.markKinds.wrong',
  added: 'recitationSummary.markKinds.added',
  corrected: 'recitationSummary.markKinds.corrected',
} as const;

function markMessageKey(mark: RecitationSummaryMark) {
  return mark.status === 'corrected'
    ? MARK_KEYS.corrected
    : MARK_KEYS[mark.kind];
}

function surahName(surah: number): string {
  const data = SURAHS[surah - 1];
  return data ? getSurahDisplayName(data) : localizeDigits(surah);
}

export const RecitationSummarySheet = (
  props: SheetProps<'recitation-summary'>,
): React.JSX.Element | null => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  const summary = props.payload?.summary;
  const [flags, setFlags] = useState<readonly ShownFlag[]>(
    summary?.flags ?? [],
  );
  if (!summary) return null;

  const first = summary.ayat[0];
  const last = summary.ayat[summary.ayat.length - 1];
  let range: string | null = null;
  if (first && last) {
    if (first.surah !== last.surah) {
      range = t('recitationSummary.rangeSurahs', {
        fromSurah: surahName(first.surah),
        from: localizeDigits(first.ayah),
        toSurah: surahName(last.surah),
        to: localizeDigits(last.ayah),
      });
    } else if (first.ayah === last.ayah) {
      range = t('recitationSummary.rangeOneAyah', {
        surah: surahName(first.surah),
        ayah: localizeDigits(first.ayah),
      });
    } else {
      range = t('recitationSummary.rangeOneSurah', {
        surah: surahName(first.surah),
        from: localizeDigits(first.ayah),
        to: localizeDigits(last.ayah),
      });
    }
  }

  const marks = summary.marks ?? [];

  async function show(flag: {surah: number; ayah: number}): Promise<void> {
    const key = `${flag.surah}:${flag.ayah}`;
    const page = digitalKhattDataService.getPageForVerse(key);
    await SheetManager.hide(props.sheetId);
    if (page) useMushafNavigationStore.getState().navigateToVerse(key, page);
  }

  async function retry(flag: {surah: number; ayah: number}): Promise<void> {
    await SheetManager.hide(props.sheetId);
    SheetManager.show('recitation-practice', {
      payload: {
        target: {
          expected: {surah: flag.surah, ayah: flag.ayah, ayahEnd: flag.ayah},
          mode: 'correction',
        },
      },
    });
  }

  async function readCorrectly(flag: ShownFlag): Promise<void> {
    setFlags(current => current.filter(f => f.key !== flag.key));
    try {
      await recitationLogDatabase.dismiss(flag);
    } catch (error) {
      console.warn('[recitation] could not save the dismissal', error);
    }
  }

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="card"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('recitationSummary.title')}</Text>
        {range ? <Text style={styles.range}>{range}</Text> : null}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}>
        {flags.length === 0 && marks.length === 0 ? (
          <Text style={styles.nothing}>{t('recitationSummary.nothing')}</Text>
        ) : null}
        {marks.map(mark => {
          const ref = recitationMarkRef(mark, mark.word);
          const where = t(ref.key, ref.values);
          return (
            <View
              key={`${mark.surah}:${mark.ayah}:${mark.word}:${mark.kind}`}
              style={styles.row}>
              <Text style={styles.ref}>{where}</Text>
              <Text style={styles.message}>{t(markMessageKey(mark))}</Text>
              <View style={styles.actions}>
                <Action
                  styles={styles}
                  label={t('recitationSummary.show')}
                  where={where}
                  onPress={() => show(mark)}
                />
                <Action
                  styles={styles}
                  label={t('recitationSummary.retry')}
                  where={where}
                  onPress={() => retry(mark)}
                />
              </View>
            </View>
          );
        })}
        {flags.length === 0 ? null : (
          <>
            <Text style={styles.sectionHeader}>
              {t('recitationSummary.worthChecking')}
            </Text>
            {flags.map(flag => {
              const where = t('recitationSummary.flagRef', {
                surah: surahName(flag.surah),
                ayah: localizeDigits(flag.ayah),
              });
              return (
                <View key={flag.key} style={styles.row}>
                  <Text style={styles.ref}>{where}</Text>
                  <Text style={styles.message}>{t(KIND_KEYS[flag.kind])}</Text>
                  <View style={styles.actions}>
                    <Action
                      styles={styles}
                      label={t('recitationSummary.show')}
                      where={where}
                      onPress={() => show(flag)}
                    />
                    <Action
                      styles={styles}
                      label={t('recitationSummary.retry')}
                      where={where}
                      onPress={() => retry(flag)}
                    />
                    <Action
                      styles={styles}
                      label={t('recitationSummary.readCorrectly')}
                      where={where}
                      onPress={() => readCorrectly(flag)}
                    />
                  </View>
                </View>
              );
            })}
          </>
        )}
        <Text style={styles.footnote}>{t('recitationSummary.footnote')}</Text>
        <Pressable
          style={[styles.doneButton, {backgroundColor: theme.colors.text}]}
          onPress={() => void SheetManager.hide(props.sheetId)}
          accessibilityRole="button">
          <Text style={[styles.doneText, {color: theme.colors.background}]}>
            {t('common:actions.done')}
          </Text>
        </Pressable>
      </ScrollView>
    </ActionSheet>
  );
};

type Styles = ReturnType<typeof createStyles>;

function Action({
  styles,
  label,
  where,
  onPress,
}: {
  styles: Styles;
  label: string;
  /** Which word or ayah, as every row has the same buttons. */
  where: string;
  onPress: () => Promise<void>;
}): React.JSX.Element {
  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${where}`}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: moderateScale(14),
      gap: moderateScale(4),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    range: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    scroll: {
      maxHeight: moderateScale(520),
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingTop: moderateScale(16),
      paddingBottom: moderateScale(40),
      gap: moderateScale(12),
    },
    nothing: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
      paddingVertical: moderateScale(8),
    },
    sectionHeader: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
      textTransform: 'uppercase',
    },
    row: {
      padding: moderateScale(12),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      gap: moderateScale(4),
    },
    ref: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    message: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(8),
      marginTop: moderateScale(6),
    },
    action: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      borderRadius: moderateScale(10),
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    actionText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    footnote: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(18),
    },
    doneButton: {
      marginTop: moderateScale(4),
      paddingVertical: moderateScale(14),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    doneText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
    },
  });
