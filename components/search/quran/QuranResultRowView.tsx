// @ai-generated
import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useHover} from '@/hooks/useHover';
import {useResponsive} from '@/hooks/useResponsive';
import {useTheme} from '@/hooks/useTheme';
import type {QuranRoot} from '@/services/search/QuranSearchDataService';
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {moderateScale} from '@/utils/scale';
import type {QuranVerseHit} from '@/utils/search/quranSearch';
import type {Theme} from '@/utils/themeUtils';
import {QURAN_PAGE_SIZE, type QuranResultRow} from './quranResultRows';
import {RootLemmaChips} from './RootLemmaChips';
import {VerseHitRow} from './VerseHitRow';

export interface QuranResultRowViewProps {
  row: QuranResultRow;
  /** The verse as the surface names it; default "Al-Baqarah 2:255". */
  verseLabel?: (hit: QuranVerseHit) => string;
  onVersePress: (hit: QuranVerseHit) => void;
  onRootPress: (root: QuranRoot) => void;
  onLemmaPress: (lemmaId: number | null) => void;
  onShowMore: () => void;
  /** On tablets, inset rows from the pane edge (default true). */
  inset?: boolean;
}

const WIDE_WINDOW = 900; // @ai (as in VerseHitRow)

/** Wraps data (Arabic root letters, a query) in a first-strong isolate. */
function isolate(value: string): string {
  return `\u{2068}${value}\u{2069}`;
}

function RootSuggestion({
  root,
  onPress,
  styles,
  theme,
  inset,
}: {
  root: QuranRoot;
  onPress: (root: QuranRoot) => void;
  styles: Styles;
  theme: Theme;
  inset: boolean;
}) {
  const {t} = useTranslation('reader');
  const {hovered, hoverProps} = useHover();
  const {isTablet, width: windowWidth} = useResponsive(); // @ai
  const title = t('quranSearch.rootSuggestion', {root: isolate(root.root)});
  return (
    <Pressable
      onPress={() => onPress(root)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={t('quranSearch.rootSuggestionHint')}
      {...hoverProps}
      style={({pressed}) => [
        styles.suggestion,
        // @ai-start
        // Tablets: inset from the pane edge with a rounded fill, like the
        // ayah rows (ipad-standards §5.2).
        isTablet && styles.suggestionTablet,
        isTablet &&
          inset &&
          (windowWidth >= WIDE_WINDOW
            ? styles.suggestionInsetWide
            : styles.suggestionInset),
        // @ai-end
        (pressed || hovered) && styles.pressed,
      ]}>
      <View style={styles.fill}>
        <Text style={styles.suggestionTitle}>{title}</Text>
        <Text style={styles.secondary}>
          {t('quranSearch.rootSuggestionHint')}
        </Text>
      </View>
      <Feather
        name="chevron-right"
        size={moderateScale(18)}
        color={Color(theme.colors.text).alpha(0.7).toString()}
        style={flipX}
      />
    </Pressable>
  );
}

function ShowMore({
  remaining,
  onPress,
  styles,
}: {
  remaining: number;
  onPress: () => void;
  styles: Styles;
}) {
  const {t} = useTranslation('reader');
  const {hovered, hoverProps} = useHover();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      {...hoverProps}
      style={({pressed}) => [
        styles.more,
        (pressed || hovered) && styles.pressed,
      ]}>
      <Text style={styles.moreText}>
        {t('quranSearch.showMore', {
          count: Math.min(remaining, QURAN_PAGE_SIZE),
        })}
      </Text>
    </Pressable>
  );
}

/** One row of the Quran results (see quranResultRows). */
export const QuranResultRowView: React.FC<QuranResultRowViewProps> = ({
  row,
  verseLabel,
  onVersePress,
  onRootPress,
  onLemmaPress,
  onShowMore,
  inset = true,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation(['reader', 'common']);
  const styles = useMemo(() => createStyles(theme), [theme]);

  switch (row.type) {
    case 'quran-loading':
      return (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          <Text style={styles.secondary}>{t('quranSearch.searching')}</Text>
        </View>
      );
    case 'quran-error':
      return (
        <View style={styles.status} accessibilityRole="alert">
          <Text style={styles.secondary}>{t('quranSearch.loadFailed')}</Text>
        </View>
      );
    case 'quran-header': {
      const summary = t('quranSearch.summary', {
        ayahs: t('quranSearch.ayahCount', {count: row.ayahCount}),
        matches: t('quranSearch.matchCount', {count: row.matchCount}),
      });
      return (
        <View style={styles.header}>
          <View style={styles.headerLine}>
            <Text style={styles.overline} accessibilityRole="header">
              {t('common:terms.ayahs')}
            </Text>
            <Text style={styles.secondary}>{summary}</Text>
          </View>
          {row.note === 'hafs' && (
            <Text style={styles.note}>{t('quranSearch.hafsNote')}</Text>
          )}
          {row.note === 'allWords' && (
            <Text style={styles.note}>{t('quranSearch.allWordsNote')}</Text>
          )}
        </View>
      );
    }
    case 'quran-root-suggestion':
      return (
        <RootSuggestion
          root={row.root}
          onPress={onRootPress}
          styles={styles}
          theme={theme}
          inset={inset}
        />
      );
    case 'quran-root-header':
      return (
        <View style={styles.rootHeader}>
          <Text style={styles.rootTitle} accessibilityRole="header">
            {t('quranSearch.rootTitle', {root: isolate(row.root.root)})}
          </Text>
          <Text style={styles.secondary}>
            {t('quranSearch.rootSummary', {
              words: t('quranSearch.wordCount', {count: row.root.words}),
              ayahs: t('quranSearch.ayahCount', {count: row.root.ayahs}),
            })}
          </Text>
        </View>
      );
    case 'quran-lemmas':
      return (
        <RootLemmaChips
          root={row.root}
          lemmas={row.lemmas}
          selected={row.selected}
          onSelect={onLemmaPress}
        />
      );
    case 'quran-verse':
      return (
        <VerseHitRow
          hit={row.hit}
          label={verseLabel?.(row.hit)}
          onPress={onVersePress}
          inset={inset}
        />
      );
    case 'quran-more':
      return (
        <ShowMore
          remaining={row.remaining}
          onPress={onShowMore}
          styles={styles}
        />
      );
    case 'quran-empty':
      return (
        <View style={styles.status}>
          <Text style={styles.emptyTitle}>
            {row.root
              ? t('quranSearch.noRoot', {root: isolate(row.query)})
              : t('quranSearch.noAyahs', {query: isolate(row.query)})}
          </Text>
          {!row.root && (
            <Text style={styles.secondary}>{t('quranSearch.noAyahsHint')}</Text>
          )}
        </View>
      );
  }
};

type Styles = ReturnType<typeof createStyles>;

const createStyles = (theme: Theme) => {
  const secondary = Color(theme.colors.textSecondary).alpha(0.8).toString();
  return StyleSheet.create({
    fill: {
      flex: 1,
    },
    pressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    status: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(16),
    },
    header: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(20),
      paddingBottom: moderateScale(6),
      gap: moderateScale(6),
    },
    headerLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: moderateScale(8),
    },
    overline: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: latinLetterSpacing(0.5),
      color: secondary,
    },
    secondary: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: secondary,
    },
    note: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
    },
    suggestion: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(10),
    },
    // @ai-start
    suggestionTablet: {
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    suggestionInset: {
      marginHorizontal: 24,
    },
    suggestionInsetWide: {
      marginHorizontal: 32,
    },
    // @ai-end
    suggestionTitle: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    rootHeader: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(16),
      paddingBottom: moderateScale(8),
      gap: moderateScale(4),
    },
    rootTitle: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    more: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: moderateScale(16),
      marginVertical: moderateScale(8),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
    },
    moreText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    emptyTitle: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
  });
};
