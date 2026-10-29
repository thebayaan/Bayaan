// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Keyboard,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {moderateScale} from '@/utils/scale';
import {computeGridLayout} from '@/utils/gridLayout';
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {SurahItem} from '@/components/SurahItem';
import {ReciterImage} from '@/components/ReciterImage';
import type {Surah} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';
import type {CatalogSearchResult} from '@/utils/search/catalog';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  getSurahMeaning,
  localizeDigits,
} from '@/i18n/format';
import type {Theme} from '@/utils/themeUtils';

export type SearchScope = 'all' | 'reciters' | 'surahs';

/** Surahs listed beside the top result in the All scope. */
const ALL_SURAH_COUNT = 4;
/** Reciters in the All scope's shelf before "See all". */
const ALL_RECITER_COUNT = 12;
/**
 * Windows at least this wide (the `expanded` class, ipad-standards §2) put
 * the top result beside the surahs. Narrower iPads stack them.
 */
export const TWO_COLUMN_MIN_WIDTH = 900;
const PANE_MARGIN = moderateScale(24);
const COLUMN_GAP = moderateScale(28);
const TOP_COLUMN_MAX_WIDTH = moderateScale(380);
const TALL_ART_SIZE = moderateScale(108);
const WIDE_ART_SIZE = moderateScale(64);
const ROW_BUTTON_SIZE = moderateScale(38);
const TALL_PLAY_SIZE = moderateScale(47);
const RECITER_TILE_WIDTH = moderateScale(104);
const RECITER_GAP = moderateScale(20);

type SurahResult = CatalogSearchResult & {type: 'surah'};
type ReciterResult = CatalogSearchResult & {type: 'reciter'};

export interface GroupedResults {
  top: CatalogSearchResult | undefined;
  surahs: SurahResult[];
  reciters: ReciterResult[];
}

/**
 * Splits ranked catalog results for the iPad layout. `top` is the best hit
 * of either kind; the lists keep their rank order and include it too, so the
 * Reciters and Surahs scopes show every match.
 */
export function groupResults(
  results: readonly CatalogSearchResult[],
): GroupedResults {
  return {
    top: results[0],
    surahs: results.filter((r): r is SurahResult => r.type === 'surah'),
    reciters: results.filter((r): r is ReciterResult => r.type === 'reciter'),
  };
}

interface TabletSearchResultsProps {
  results: readonly CatalogSearchResult[];
  /** Opens a result: the reciter's profile, or the surah in the Mushaf. */
  onResultPress: (result: CatalogSearchResult) => void;
  /** Plays a surah the way a long press does (default or chosen reciter). */
  onSurahPlay: (result: CatalogSearchResult) => void;
  /** Opens the surah options menu. */
  onSurahOptions: (result: CatalogSearchResult) => void;
  bottomPadding: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Search results on iPad (mockup L7): All / Reciters / Surahs scopes, and in
 * All a top result card beside the first surah matches, then a reciters
 * shelf. Surah rows carry visible play and options buttons so audio is never
 * long-press only.
 */
export function TabletSearchResults({
  results,
  onResultPress,
  onSurahPlay,
  onSurahOptions,
  bottomPadding,
  style,
}: TabletSearchResultsProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const {width} = useResponsive();
  const twoColumn = width >= TWO_COLUMN_MIN_WIDTH;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [scope, setScope] = useState<SearchScope>('all');
  const grouped = useMemo(() => groupResults(results), [results]);
  // The Reciters scope sizes its tiles to fill each row of the grid.
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const handleGridLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setGridWidth(prev => (prev === next ? prev : next));
  }, []);
  const reciterGrid =
    gridWidth === null
      ? null
      : computeGridLayout(gridWidth, {
          minCardWidth: RECITER_TILE_WIDTH,
          horizontalPadding: 0,
          gap: RECITER_GAP,
        });
  // Whole points: the measured width is rounded to the pixel grid, so tiles
  // that fill it exactly can overflow by a fraction and wrap a row early.
  const reciterTileWidth = reciterGrid && Math.floor(reciterGrid.itemWidth);

  const scopes: {key: SearchScope; label: string; count?: number}[] = [
    {key: 'all', label: t('search.all')},
    {
      key: 'reciters',
      label: t('common:terms.reciters'),
      count: grouped.reciters.length,
    },
    {
      key: 'surahs',
      label: t('common:terms.surahs'),
      count: grouped.surahs.length,
    },
  ];

  const surahRow = (result: SurahResult) => (
    <SurahResultRow
      key={`surah-${result.item.id}`}
      result={result}
      onPress={onResultPress}
      onPlay={onSurahPlay}
      onOptions={onSurahOptions}
      styles={styles}
      theme={theme}
    />
  );

  const reciterTile = (result: ReciterResult, size = RECITER_TILE_WIDTH) => (
    <ReciterTile
      key={`reciter-${result.item.id}`}
      result={result}
      size={size}
      onPress={onResultPress}
      styles={styles}
    />
  );

  const sectionHeader = (title: string, more?: SearchScope) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {more && (
        <Pressable
          onPress={() => setScope(more)}
          hitSlop={8}
          accessibilityRole="button">
          <Text style={styles.seeAll}>{t('common:actions.seeAll')}</Text>
        </Pressable>
      )}
    </View>
  );

  const topSurahs = grouped.surahs
    .filter(r => r !== grouped.top)
    .slice(0, ALL_SURAH_COUNT);
  const shelfReciters = grouped.reciters
    .filter(r => r !== grouped.top)
    .slice(0, ALL_RECITER_COUNT);
  // A lone top result spans the pane rather than leaving the surah column
  // empty beside it.
  const sideBySide = twoColumn && topSurahs.length > 0;

  return (
    <ScrollView
      style={[styles.fill, style]}
      contentContainerStyle={[styles.content, {paddingBottom: bottomPadding}]}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={() => Keyboard.dismiss()}
      showsVerticalScrollIndicator={false}>
      <View style={styles.scopes} accessibilityRole="tablist">
        {scopes.map(s => {
          const selected = s.key === scope;
          return (
            <Pressable
              key={s.key}
              onPress={() => setScope(s.key)}
              accessibilityRole="tab"
              accessibilityState={{selected}}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}>
                {s.label}
              </Text>
              {s.count !== undefined && (
                <Text
                  style={[
                    styles.chipText,
                    styles.chipCount,
                    selected && styles.chipTextSelected,
                  ]}>
                  {localizeDigits(s.count)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {scope === 'all' && grouped.top && (
        <>
          <View style={sideBySide ? styles.topRow : undefined}>
            <View style={sideBySide ? styles.topColumn : styles.section}>
              {sectionHeader(t('search.topResult'))}
              <TopResultCard
                result={grouped.top}
                tall={sideBySide}
                onPress={onResultPress}
                onPlay={onSurahPlay}
                onOptions={onSurahOptions}
                styles={styles}
                theme={theme}
              />
            </View>
            {topSurahs.length > 0 && (
              <View style={sideBySide ? styles.surahColumn : styles.section}>
                {sectionHeader(
                  t('common:terms.surahs'),
                  grouped.surahs.length > topSurahs.length
                    ? 'surahs'
                    : undefined,
                )}
                {topSurahs.map(surahRow)}
              </View>
            )}
          </View>
          {shelfReciters.length > 0 && (
            <View style={styles.section}>
              {sectionHeader(
                t('common:terms.reciters'),
                grouped.reciters.length > shelfReciters.length
                  ? 'reciters'
                  : undefined,
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.shelfScroller}
                contentContainerStyle={styles.shelf}>
                {shelfReciters.map(r => reciterTile(r))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {scope === 'surahs' && (
        // Wide windows flow the rows into two columns so the play and
        // options buttons stay near the names.
        <View style={[styles.section, twoColumn && styles.surahGrid]}>
          {grouped.surahs.map((r, i) =>
            twoColumn ? (
              <View
                key={`cell-${r.item.id}`}
                style={[
                  styles.surahCell,
                  i % 2 === 0 ? styles.surahCellStart : styles.surahCellEnd,
                ]}>
                {surahRow(r)}
              </View>
            ) : (
              surahRow(r)
            ),
          )}
        </View>
      )}

      {scope === 'reciters' && (
        <View
          style={[styles.section, styles.reciterGrid]}
          onLayout={handleGridLayout}>
          {reciterTileWidth !== null &&
            grouped.reciters.map(r => reciterTile(r, reciterTileWidth))}
        </View>
      )}
    </ScrollView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function PlayButton({
  onPress,
  hint,
  size,
  styles,
  theme,
  style,
}: {
  onPress: () => void;
  hint: string;
  size: number;
  styles: Styles;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
}) {
  const {t} = useTranslation('common');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('actions.play')}
      accessibilityHint={hint}
      style={[
        styles.playButton,
        {width: size, height: size, borderRadius: size / 2},
        style,
      ]}>
      <Feather
        name="play"
        size={size * 0.42}
        color={theme.colors.background}
        style={styles.playIcon}
      />
    </Pressable>
  );
}

function SurahResultRow({
  result,
  onPress,
  onPlay,
  onOptions,
  styles,
  theme,
}: {
  result: SurahResult;
  onPress: (result: CatalogSearchResult) => void;
  onPlay: (result: CatalogSearchResult) => void;
  onOptions: (result: CatalogSearchResult) => void;
  styles: Styles;
  theme: Theme;
}) {
  return (
    <View style={styles.surahRow}>
      <View style={styles.fill}>
        <SurahItem
          pressAction="read"
          item={result.item as Surah}
          onPress={() => onPress(result)}
          onLongPress={() => onPlay(result)}
        />
      </View>
      <PlayButton
        onPress={() => onPlay(result)}
        hint={getSurahDisplayName(result.item as Surah)}
        size={ROW_BUTTON_SIZE}
        styles={styles}
        theme={theme}
      />
      <MoreButton
        onPress={() => onOptions(result)}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

function MoreButton({
  onPress,
  styles,
  theme,
}: {
  onPress: () => void;
  styles: Styles;
  theme: Theme;
}) {
  const {t} = useTranslation('home');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('surahItem.moreOptions')}
      accessibilityHint={t('surahItem.moreOptionsHint')}
      style={styles.moreButton}>
      <Feather
        name="more-horizontal"
        size={moderateScale(18)}
        color={theme.colors.text}
      />
    </Pressable>
  );
}

function ReciterTile({
  result,
  size,
  onPress,
  styles,
}: {
  result: ReciterResult;
  size: number;
  onPress: (result: CatalogSearchResult) => void;
  styles: Styles;
}) {
  const reciter = result.item as Reciter;
  return (
    <Pressable
      onPress={() => onPress(result)}
      accessibilityRole="button"
      style={[styles.reciterTile, {width: size}]}>
      <ReciterImage
        imageUrl={reciter.image_url || undefined}
        reciterName={reciter.name}
        style={{width: size, height: size, borderRadius: size / 2}}
        profileIconSize={moderateScale(32)}
      />
      <Text style={styles.reciterTileName} numberOfLines={2}>
        {getReciterDisplayName(reciter)}
      </Text>
    </Pressable>
  );
}

/**
 * The best match. `tall` is the card beside the surah list on wide windows;
 * otherwise it is a full-width row. The play button sits outside the card's
 * pressable so VoiceOver can reach both.
 */
function TopResultCard({
  result,
  tall,
  onPress,
  onPlay,
  onOptions,
  styles,
  theme,
}: {
  result: CatalogSearchResult;
  tall: boolean;
  onPress: (result: CatalogSearchResult) => void;
  onPlay: (result: CatalogSearchResult) => void;
  onOptions: (result: CatalogSearchResult) => void;
  styles: Styles;
  theme: Theme;
}) {
  const {t} = useTranslation(['home', 'common']);
  const artSize = tall ? TALL_ART_SIZE : WIDE_ART_SIZE;
  const isReciter = result.type === 'reciter';
  const reciter = result.item as Reciter;
  const surah = result.item as Surah;

  let art: React.ReactNode;
  let title: string;
  let meta: string | null = null;
  if (isReciter) {
    title = getReciterDisplayName(reciter);
    art = (
      <ReciterImage
        imageUrl={reciter.image_url || undefined}
        reciterName={reciter.name}
        style={{width: artSize, height: artSize, borderRadius: artSize / 2}}
        profileIconSize={artSize * 0.4}
      />
    );
  } else {
    title = `${localizeDigits(surah.id)} · ${getSurahDisplayName(surah)}`;
    const meaning = getSurahMeaning(surah);
    const verses = t('surahItem.verses', {count: surah.verses_count});
    meta = meaning ? `${meaning} · ${verses}` : verses;
    art = (
      <View
        style={[
          styles.surahArt,
          {width: artSize, height: artSize, borderRadius: artSize * 0.18},
        ]}>
        <Text
          style={[styles.surahArtGlyph, {fontSize: artSize * 0.36}]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {surahGlyphMap[surah.id]}
        </Text>
      </View>
    );
  }
  const kind = (
    <Text style={styles.kindChip}>
      {t(isReciter ? 'common:terms.reciter' : 'common:terms.surah')}
    </Text>
  );
  // A surah gets play and options; the tall card keeps play in its corner.
  const playButton = isReciter ? null : (
    <PlayButton
      onPress={() => onPlay(result)}
      hint={getSurahDisplayName(surah)}
      size={tall ? TALL_PLAY_SIZE : moderateScale(42)}
      styles={styles}
      theme={theme}
    />
  );
  const moreButton = isReciter ? null : (
    <MoreButton
      onPress={() => onOptions(result)}
      styles={styles}
      theme={theme}
    />
  );
  const play = isReciter ? null : (
    <View style={tall ? styles.tallActions : styles.wideActions}>
      {tall ? moreButton : playButton}
      {tall ? playButton : moreButton}
    </View>
  );
  const chevron = isReciter ? (
    <Feather
      name="chevron-right"
      size={moderateScale(22)}
      color={theme.colors.textSecondary}
      style={flipX}
    />
  ) : null;

  if (tall) {
    return (
      <View style={styles.topCard}>
        <Pressable
          onPress={() => onPress(result)}
          accessibilityRole="button"
          style={styles.topCardTallBody}>
          {art}
          <View style={styles.topText}>
            <Text style={styles.topTitle} numberOfLines={2}>
              {title}
            </Text>
            {meta && (
              <Text style={styles.topMeta} numberOfLines={1}>
                {meta}
              </Text>
            )}
          </View>
          <View style={styles.topFooter}>
            {kind}
            {chevron}
          </View>
        </Pressable>
        {play}
      </View>
    );
  }
  return (
    <View style={[styles.topCard, styles.topCardWide]}>
      <Pressable
        onPress={() => onPress(result)}
        accessibilityRole="button"
        style={styles.topCardWideBody}>
        {art}
        <View style={[styles.fill, styles.topText]}>
          <Text style={styles.topTitleWide} numberOfLines={1}>
            {title}
          </Text>
          {meta && (
            <Text style={styles.topMeta} numberOfLines={1}>
              {meta}
            </Text>
          )}
          <View style={styles.kindRow}>{kind}</View>
        </View>
        {chevron}
      </Pressable>
      {play}
    </View>
  );
}

const createStyles = (theme: Theme) => {
  const faint = Color(theme.colors.text).alpha(0.06).toString();
  const divider = Color(theme.colors.text).alpha(0.08).toString();
  return StyleSheet.create({
    fill: {
      flex: 1,
    },
    content: {
      paddingTop: moderateScale(8),
      paddingHorizontal: PANE_MARGIN,
    },
    scopes: {
      flexDirection: 'row',
      gap: moderateScale(8),
      paddingBottom: moderateScale(8),
    },
    chip: {
      height: moderateScale(34),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(17),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      backgroundColor: faint,
    },
    chipSelected: {
      backgroundColor: theme.colors.text,
    },
    chipText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: theme.colors.background,
    },
    chipCount: {
      fontFamily: theme.fonts.medium,
      opacity: 0.6,
    },
    section: {
      marginTop: moderateScale(20),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: moderateScale(10),
    },
    sectionTitle: {
      fontSize: moderateScale(20),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      letterSpacing: latinLetterSpacing(-0.2),
    },
    seeAll: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    topRow: {
      flexDirection: 'row',
      marginTop: moderateScale(20),
      gap: COLUMN_GAP,
    },
    topColumn: {
      width: '40%',
      maxWidth: TOP_COLUMN_MAX_WIDTH,
    },
    surahColumn: {
      flex: 1,
      minWidth: 0,
    },
    topCard: {
      borderRadius: moderateScale(18),
      backgroundColor: faint,
    },
    topCardTallBody: {
      padding: moderateScale(20),
      gap: moderateScale(12),
    },
    tallActions: {
      position: 'absolute',
      bottom: moderateScale(20),
      end: moderateScale(20),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    wideActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    topCardWide: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingEnd: moderateScale(16),
    },
    topCardWideBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: moderateScale(14),
      gap: moderateScale(16),
    },
    topText: {
      gap: moderateScale(4),
    },
    surahArt: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: faint,
    },
    surahArtGlyph: {
      fontFamily: 'SurahNames',
      color: theme.colors.text,
      textAlign: 'center',
      width: '100%',
    },
    topTitle: {
      fontSize: moderateScale(25),
      lineHeight: moderateScale(31),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    topTitleWide: {
      fontSize: moderateScale(19),
      lineHeight: moderateScale(25),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    topMeta: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    topFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Leaves room for the play button in the card's corner.
      minHeight: TALL_PLAY_SIZE,
    },
    kindRow: {
      flexDirection: 'row',
      marginTop: moderateScale(2),
    },
    kindChip: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      backgroundColor: faint,
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
    },
    surahRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },
    playButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
    playIcon: {
      // The triangle always points right, and its visual center sits left
      // of its box.
      marginLeft: moderateScale(2),
    },
    moreButton: {
      width: ROW_BUTTON_SIZE,
      height: ROW_BUTTON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shelfScroller: {
      marginHorizontal: -PANE_MARGIN,
    },
    shelf: {
      paddingHorizontal: PANE_MARGIN,
      gap: RECITER_GAP,
    },
    reciterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: RECITER_GAP,
    },
    reciterTile: {
      alignItems: 'center',
      gap: moderateScale(8),
    },
    surahGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    surahCell: {
      width: '50%',
    },
    surahCellStart: {
      paddingEnd: COLUMN_GAP / 2,
    },
    surahCellEnd: {
      paddingStart: COLUMN_GAP / 2,
    },
    reciterTileName: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      textAlign: 'center',
    },
  });
};
