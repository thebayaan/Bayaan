// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import SkiaVerseText from '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText';
import {useHover} from '@/hooks/useHover';
import {useMushafFontMgr} from '@/hooks/useMushafFontMgr';
import {useResponsive} from '@/hooks/useResponsive';
import {useRewayahWords} from '@/hooks/useRewayahWords';
import {useTheme} from '@/hooks/useTheme';
import {localizeDigits} from '@/i18n/format';
import {joinWholeWords} from '@/services/mushaf/lineWordSpans';
import {
  getDkFontFamily,
  useMushafSettingsStore,
} from '@/store/mushafSettingsStore';
import {moderateScale} from '@/utils/scale';
import {matchedPositions, type QuranVerseHit} from '@/utils/search/quranSearch';
import {verseSnippet} from '@/utils/search/verseSnippet';
import type {Theme} from '@/utils/themeUtils';
import {useQuranVerseLabel} from './quranVerseLabel';

/** From this window width, tablet rows sit 32pt in (ipad-standards §5.2). */
const WIDE_WINDOW = 900;
const SNIPPET_FONT_SIZE = moderateScale(22);

export interface VerseHitRowProps {
  hit: QuranVerseHit;
  /** The verse as the surface names it ("Al-Baqarah 2:254 · Warsh"). */
  label?: string;
  onPress: (hit: QuranVerseHit) => void;
  /** On tablets, inset the row from the pane edge (off where the pane
   *  already pads its content). Default true. */
  inset?: boolean;
}

/**
 * One ayah of the Quran search results: its reference, a match-count badge,
 * and its Hafs text (the whole ayah up to 20 words, else a window around the
 * first match) with the matched words tinted.
 */
export const VerseHitRow: React.FC<VerseHitRowProps> = ({
  hit,
  label,
  onPress,
  inset = true,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('reader');
  const {isTablet, width: windowWidth} = useResponsive();
  const {hovered, hoverProps} = useHover();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const verseLabel = useQuranVerseLabel();
  const fontMgr = useMushafFontMgr();
  const mushafRenderer = useMushafSettingsStore(s => s.mushafRenderer);
  const arabicTextWeight = useMushafSettingsStore(s => s.arabicTextWeight);
  const {words, status} = useRewayahWords(hit.verseKey, 'hafs');
  const snippet = useMemo(
    () => verseSnippet(words, matchedPositions(hit)),
    [words, hit],
  );
  const [textWidth, setTextWidth] = useState(0);
  const handleTextLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    setTextWidth(prev => (prev === next ? prev : next));
  }, []);
  const handlePress = useCallback(() => onPress(hit), [onPress, hit]);

  const reference = label ?? verseLabel(hit.verseKey);
  const matchCount = hit.matches.length;
  const highlightColor = Color(theme.colors.text)
    .alpha(theme.isDarkMode ? 0.22 : 0.25)
    .toString();
  const ready = status === 'ready' && snippet.words.length > 0;
  const plainText = joinWholeWords(snippet.words);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('quranSearch.hitLabel', {
        verse: reference,
        text: plainText,
      })}
      accessibilityHint={t('quranSearch.hitHint')}
      {...hoverProps}
      style={({pressed}) => [
        styles.row,
        isTablet && styles.rowTablet,
        isTablet &&
          inset &&
          (windowWidth >= WIDE_WINDOW ? styles.insetWide : styles.inset),
        (pressed || hovered) && styles.rowPressed,
      ]}>
      <View style={styles.header}>
        <Text style={styles.reference} numberOfLines={1}>
          {localizeDigits(reference)}
        </Text>
        {matchCount > 1 && (
          <Text style={styles.badge}>
            {t('quranSearch.matchCount', {count: matchCount})}
          </Text>
        )}
      </View>
      {/* The Quran text reads right to left in every UI language. */}
      <View style={styles.snippet}>
        {snippet.cutStart && (
          <Text style={[styles.ellipsis, styles.ellipsisStart]}>
            {t('quranSearch.ellipsis')}
          </Text>
        )}
        <View style={styles.snippetText} onLayout={handleTextLayout}>
          {ready && fontMgr && textWidth > 0 ? (
            <SkiaVerseText
              verseKey={hit.verseKey}
              rewayah="hafs"
              words={snippet.words}
              fontMgr={fontMgr}
              fontFamily={getDkFontFamily(mushafRenderer, 'hafs')}
              fontSize={SNIPPET_FONT_SIZE}
              textColor={theme.colors.text}
              showTajweed={false}
              indexedTajweedData={null}
              arabicTextWeight={arabicTextWeight}
              width={textWidth}
              highlightRanges={snippet.highlights}
              highlightColor={highlightColor}
            />
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
        {snippet.cutEnd && (
          <Text style={[styles.ellipsis, styles.ellipsisEnd]}>
            {t('quranSearch.ellipsis')}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: 44,
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(12),
      gap: moderateScale(6),
    },
    // Tablets: a rounded pressed and hover fill, inset from the pane edge
    // (ipad-standards §5.2).
    rowTablet: {
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    inset: {
      marginHorizontal: 24,
    },
    insetWide: {
      marginHorizontal: 32,
    },
    rowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: moderateScale(8),
    },
    reference: {
      flexShrink: 1,
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    badge: {
      fontSize: moderateScale(11),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      paddingHorizontal: moderateScale(8),
      paddingVertical: moderateScale(2),
      borderRadius: moderateScale(8),
      overflow: 'hidden',
    },
    snippet: {
      flexDirection: 'row',
      direction: 'rtl',
    },
    snippetText: {
      flex: 1,
    },
    placeholder: {
      height: SNIPPET_FONT_SIZE * 2,
    },
    ellipsis: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: Color(theme.colors.textSecondary).alpha(0.8).toString(),
      paddingHorizontal: moderateScale(2),
    },
    ellipsisStart: {
      alignSelf: 'flex-start',
    },
    ellipsisEnd: {
      alignSelf: 'flex-end',
    },
  });
