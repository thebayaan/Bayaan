import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {
  ScrollView,
  SheetManager,
  type SheetProps,
} from 'react-native-actions-sheet';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {SURAHS} from '@/data/surahData';
import {useTheme} from '@/hooks/useTheme';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import type {FlagKind} from '@/services/recitation/flags';
import {
  startPractice,
  stopPractice,
} from '@/services/recitation/practice/PracticeService';
import type {
  PracticeOutcome,
  PracticeTarget,
} from '@/services/recitation/practice/types';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {usePracticeStore, type PracticeErrorCode} from '@/store/practiceStore';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

// A short practice take on one target (Retry from the summary): recite it
// from memory, peek if needed, then see whether anything is still worth
// checking. Never red, never a sound.

const VERDICT_KEYS = {
  clean: 'practice.verdict.clean',
  flagged: 'practice.verdict.flagged',
  partial: 'practice.verdict.partial',
  other: 'practice.verdict.other',
  nothing: 'practice.verdict.nothing',
} as const satisfies Record<PracticeOutcome, string>;

const KIND_KEYS = {
  skippedAyah: 'recitationSummary.kinds.skippedAyah',
  skippedWord: 'recitationSummary.kinds.skippedWord',
  similarAyah: 'recitationSummary.kinds.similarAyah',
  differentWord: 'recitationSummary.kinds.differentWord',
} as const satisfies Record<FlagKind, string>;

const ERROR_KEYS = {
  permission: 'whichAyah.errors.permission',
  download: 'whichAyah.errors.download',
  mic: 'whichAyah.errors.mic',
  interrupted: 'whichAyah.errors.interrupted',
  other: 'whichAyah.errors.other',
} as const satisfies Record<PracticeErrorCode, string>;

const SHEET_PADDING = 20;

function surahName(surah: number): string {
  const data = SURAHS[surah - 1];
  return data ? getSurahDisplayName(data) : localizeDigits(surah);
}

export const RecitationPracticeSheet = (
  props: SheetProps<'recitation-practice'>,
): React.JSX.Element | null => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  const target = props.payload?.target;
  const status = usePracticeStore(s => s.status);
  const progress = usePracticeStore(s => s.downloadProgress);
  const verdict = usePracticeStore(s => s.verdict);
  const error = usePracticeStore(s => s.error);
  const [peeking, setPeeking] = useState(false);

  const begin = useCallback(() => {
    if (target) void startPractice(target);
  }, [target]);

  useEffect(() => {
    begin();
    return () => {
      void stopPractice();
    };
  }, [begin]);

  if (!target) return null;

  const passage = target.expected;
  const passageEnd = passage ? (passage.ayahEnd ?? passage.ayah) : 0;
  const label = !passage
    ? ''
    : passageEnd === passage.ayah
      ? t('recitationSummary.rangeOneAyah', {
          surah: surahName(passage.surah),
          ayah: localizeDigits(passage.ayah),
        })
      : t('recitationSummary.rangeOneSurah', {
          surah: surahName(passage.surah),
          from: localizeDigits(passage.ayah),
          to: localizeDigits(passageEnd),
        });

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="card"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('practice.title')}</Text>
        <Text style={styles.subtitle}>{label}</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.prompt}>{t('practice.reciteFromMemory')}</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setPeeking(p => !p)}
          accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>
            {peeking ? t('practice.hideAyah') : t('practice.showAyah')}
          </Text>
        </Pressable>
        {peeking && (
          <TargetText target={target} styles={styles} theme={theme} />
        )}
        {status === 'done' && verdict ? (
          <>
            <Text style={styles.statusText}>
              {t(VERDICT_KEYS[verdict.outcome])}
            </Text>
            {verdict.flags.map(flag => (
              <Text key={flag.key} style={styles.flagText}>
                {t('practice.flagLine', {
                  ref: t('recitationSummary.flagRef', {
                    surah: surahName(flag.surah),
                    ayah: localizeDigits(flag.ayah),
                  }),
                  message: t(KIND_KEYS[flag.kind]),
                })}
              </Text>
            ))}
            <PrimaryButton
              styles={styles}
              theme={theme}
              label={t('common:actions.tryAgain')}
              onPress={begin}
            />
          </>
        ) : status === 'error' ? (
          <>
            <Text style={styles.statusText}>
              {t(ERROR_KEYS[error?.code ?? 'other'])}
            </Text>
            <PrimaryButton
              styles={styles}
              theme={theme}
              label={t('common:actions.tryAgain')}
              onPress={begin}
            />
          </>
        ) : (
          <View style={styles.listening}>
            <ActivityIndicator size="small" color={theme.colors.text} />
            <Text style={styles.statusText}>
              {status === 'downloading'
                ? t('whichAyah.downloading', {
                    percent: localizeDigits(Math.round(progress * 100)),
                  })
                : status === 'paused'
                  ? t('whichAyah.paused')
                  : status === 'listening'
                    ? t('whichAyah.listening')
                    : t('whichAyah.loading')}
            </Text>
          </View>
        )}
        <Text style={styles.footnote}>{t('recitationSummary.footnote')}</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void SheetManager.hide(props.sheetId)}
          accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>
            {t('common:actions.done')}
          </Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};

type Styles = ReturnType<typeof createStyles>;
/** The target's first ayah, from the app's Hafs text, for a peek. */
function TargetText({
  target,
  styles,
  theme,
}: {
  target: PracticeTarget;
  styles: Styles;
  theme: Theme;
}): React.JSX.Element | null {
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const fontMgr = useMushafFontMgr();
  const width = useSheetWidth() - moderateScale(SHEET_PADDING) * 2;
  const passage = target.expected;
  if (!passage || !fontMgr || width <= 0) return null;
  return (
    <ScrollView style={styles.verseBox}>
      <SkiaVerseText
        verseKey={`${passage.surah}:${passage.ayah}`}
        rewayah="hafs"
        fontMgr={fontMgr}
        fontFamily={getDkFontFamily(mushafRenderer, 'hafs')}
        fontSize={moderateScale(20)}
        textColor={theme.colors.text}
        showTajweed={false}
        width={width}
        indexedTajweedData={null}
        arabicTextWeight={arabicTextWeight}
        textAlign="center"
      />
    </ScrollView>
  );
}

function PrimaryButton({
  styles,
  theme,
  label,
  onPress,
}: {
  styles: Styles;
  theme: Theme;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
      onPress={onPress}
      accessibilityRole="button">
      <Text
        style={[styles.primaryButtonText, {color: theme.colors.background}]}>
        {label}
      </Text>
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
    subtitle: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    container: {
      paddingHorizontal: moderateScale(SHEET_PADDING),
      paddingTop: moderateScale(16),
      paddingBottom: moderateScale(40),
      gap: moderateScale(12),
    },
    prompt: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseBox: {
      maxHeight: moderateScale(240),
    },
    listening: {
      alignItems: 'center',
      gap: moderateScale(10),
      paddingVertical: moderateScale(12),
    },
    statusText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    flagText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    footnote: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(18),
      textAlign: 'center',
    },
    primaryButton: {
      paddingVertical: moderateScale(14),
      borderRadius: moderateScale(12),
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
    },
    secondaryButton: {
      paddingVertical: moderateScale(10),
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
  });
