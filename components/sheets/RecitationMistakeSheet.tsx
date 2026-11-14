import React, {useEffect} from 'react';
import {Pressable, Text, View} from 'react-native';
import {SheetManager, type SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import ActionSheet, {
  useSheetWidth,
} from '@/components/sheets/AdaptiveActionSheet';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {dkWordPosition} from '@/components/mushaf/skia/recitedWord';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useTheme} from '@/hooks/useTheme';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  dismissRecitationMark,
  holdRecitationTracking,
  releaseRecitationTracking,
} from '@/services/recitation/RecitationTrackingService';
import type {WordMark} from '@/services/recitation/wordMarks';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';
import {recitationMarkRef} from './recitationMarkRef';

// A word marked while reciting, tapped on the page: what may have happened,
// the word as it is written, and its ayah. The recitation is held while the
// sheet is open. Wording is always "may have"; a teacher is the authority.

const MESSAGE_KEYS = {
  missed: 'recitationSummary.markKinds.missed',
  wrong: 'recitationSummary.markKinds.wrong',
  added: 'recitationSummary.markKinds.added',
  corrected: 'recitationSummary.markKinds.corrected',
} as const;

const SHEET_PADDING = 20;

/** Plays one ayah with the mushaf reciter (ends any recitation take). */
async function playAyah(surah: number, ayah: number): Promise<void> {
  const key = `${surah}:${ayah}`;
  const page = digitalKhattDataService.getPageForVerse(key);
  if (!page) return;
  const player = useMushafPlayerStore.getState();
  if (!player.rewayatId) {
    // No mushaf reciter yet: ask for one, then play from this ayah.
    useMushafPlayerStore.setState({
      currentPage: page,
      pendingStartVerseKey: key,
    });
    SheetManager.show('mushaf-player-options', {
      payload: {currentPage: page},
    });
    return;
  }
  player.setRange({surah, ayah}, {surah, ayah});
  player.setVerseRepeatCount(1);
  player.setRangeRepeatCount(1);
  await player.startPlayback(page, key);
}

export const RecitationMistakeSheet = (
  props: SheetProps<'recitation-mistake'>,
): React.JSX.Element | null => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {t} = useTranslation(['sheets', 'common']);
  const mark = props.payload?.mark;

  useEffect(() => {
    const held = holdRecitationTracking();
    return () => {
      if (held) releaseRecitationTracking();
    };
  }, []);

  if (!mark) return null;
  const verseKey = `${mark.surah}:${mark.ayah}`;
  const position =
    dkWordPosition(
      digitalKhattDataService.getVerseWords(verseKey),
      mark.word,
      mark.totalWords,
    ) ?? mark.word + 1;
  const message =
    mark.status === 'corrected'
      ? t(MESSAGE_KEYS.corrected)
      : t(MESSAGE_KEYS[mark.kind]);
  const where = recitationMarkRef(mark, position);

  async function listen(): Promise<void> {
    if (!mark) return;
    await SheetManager.hide(props.sheetId);
    await playAyah(mark.surah, mark.ayah);
  }

  async function readCorrectly(): Promise<void> {
    if (!mark) return;
    await dismissRecitationMark(mark);
    await SheetManager.hide(props.sheetId);
  }

  return (
    <ActionSheet
      id={props.sheetId}
      tabletPresentation="card"
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{message}</Text>
        <Text style={styles.ref}>{t(where.key, where.values)}</Text>
      </View>
      <View style={styles.container}>
        <MarkedText
          mark={mark}
          verseKey={verseKey}
          position={position}
          styles={styles}
          theme={theme}
        />
        <Pressable
          style={[styles.primaryButton, {backgroundColor: theme.colors.text}]}
          onPress={listen}
          accessibilityRole="button">
          <Text
            style={[
              styles.primaryButtonText,
              {color: theme.colors.background},
            ]}>
            {t('recitationMistake.listen')}
          </Text>
        </Pressable>
        <Text style={styles.note}>{t('recitationMistake.listenNote')}</Text>
        {mark.status === 'mistake' && (
          <Pressable
            style={styles.secondaryButton}
            onPress={readCorrectly}
            accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>
              {t('recitationSummary.readCorrectly')}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void SheetManager.hide(props.sheetId)}
          accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>
            {t('recitationMistake.continue')}
          </Text>
        </Pressable>
        <Text style={styles.footnote}>{t('recitationSummary.footnote')}</Text>
      </View>
    </ActionSheet>
  );
};

type Styles = ReturnType<typeof createStyles>;

/**
 * The word as it is written (Hafs, mushaf font), then its whole ayah. An added
 * mark's word was read correctly, so that one shows the ayah alone; what was heard
 * is never shown, as it is not Quran text.
 */
function MarkedText({
  mark,
  verseKey,
  position,
  styles,
  theme,
}: {
  mark: WordMark;
  verseKey: string;
  position: number;
  styles: Styles;
  theme: Theme;
}): React.JSX.Element | null {
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const fontMgr = useMushafFontMgr();
  const width = useSheetWidth() - moderateScale(SHEET_PADDING) * 2;
  if (!fontMgr || width <= 0) return null;
  const word =
    mark.kind === 'added'
      ? null
      : digitalKhattDataService
          .getVerseWords(verseKey)
          .find(w => w.wordPositionInVerse === position);
  const fontFamily = getDkFontFamily(mushafRenderer, 'hafs');
  return (
    <View style={styles.textBlock}>
      {word && (
        <SkiaVerseText
          verseKey={verseKey}
          words={[word]}
          rewayah="hafs"
          fontMgr={fontMgr}
          fontFamily={fontFamily}
          fontSize={moderateScale(34)}
          textColor={theme.colors.text}
          showTajweed={false}
          width={width}
          indexedTajweedData={null}
          arabicTextWeight={arabicTextWeight}
          textAlign="center"
        />
      )}
      {/* Drawn on a canvas, so a screen reader needs the text said for it. */}
      <View
        accessible
        accessibilityLabel={digitalKhattDataService.getVerseText(
          verseKey,
          'hafs',
        )}>
        <SkiaVerseText
          verseKey={verseKey}
          rewayah="hafs"
          fontMgr={fontMgr}
          fontFamily={fontFamily}
          fontSize={moderateScale(19)}
          textColor={theme.colors.textSecondary}
          showTajweed={false}
          width={width}
          indexedTajweedData={null}
          arabicTextWeight={arabicTextWeight}
          textAlign="center"
        />
      </View>
    </View>
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
      paddingHorizontal: moderateScale(SHEET_PADDING),
      gap: moderateScale(4),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    headerTitle: {
      fontSize: moderateScale(17),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
    ref: {
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
    textBlock: {
      gap: moderateScale(8),
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
    note: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textAlign: 'center',
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
    footnote: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      lineHeight: moderateScale(18),
      textAlign: 'center',
    },
  });
