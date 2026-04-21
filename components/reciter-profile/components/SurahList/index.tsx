import React from 'react';
import {Text, View, InteractionManager} from 'react-native';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {SurahListProps} from '@/components/reciter-profile/types';
import {SurahItem} from '@/components/SurahItem';
import {SurahCard} from '@/components/cards/SurahCard';
import {Surah} from '@/data/surahData';
import {getJuzForSurah, getJuzName} from '@/data/juzData';

// Define types matching useSettings and ReciterProfile
type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation'; // Include revelation order

// Discriminated union for FlashList items
type FlatItem =
  | {type: 'juz-header'; juzName: string; key: string}
  | {type: 'surah-row'; surahs: Surah[]; key: string};

// Update props interface (consider moving this to types/reciter-profile.ts)
interface UpdatedSurahListProps extends SurahListProps {
  viewMode: ReciterProfileViewMode;
  getColorForSurah: (id: number) => string;
  sortOption: ReciterProfileSortOption;
  rewayatId?: string;
  inline?: boolean;
}

// Shared ItemSeparator component
const ItemSeparator = React.memo(() => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  return <View style={styles.listSeparator} />;
});
ItemSeparator.displayName = 'ItemSeparator';

/**
 * SurahList component for the ReciterProfile
 *
 * Displays surahs in either a list or grid view.
 */
export const SurahList = React.forwardRef<
  FlashListRef<FlatItem>,
  UpdatedSurahListProps
>(
  (
    {
      surahs,
      onSurahPress,
      reciterId,
      isLoved,
      isDownloaded,
      onOptionsPress,
      onScroll,
      ListHeaderComponent,
      ListFooterComponent,
      contentContainerStyle,
      viewMode,
      getColorForSurah,
      sortOption,
      rewayatId,
      inline,
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    // Build flat data array + sticky header indices
    const {data, stickyIndices} = React.useMemo(() => {
      const items: FlatItem[] = [];
      const stickies: number[] = [];
      const showJuzHeaders =
        viewMode === 'list' && (sortOption === 'asc' || sortOption === 'desc');

      if (viewMode === 'card') {
        // Group surahs into pairs for card view
        for (let i = 0; i < surahs.length; i += 2) {
          const pair =
            i + 1 < surahs.length ? [surahs[i], surahs[i + 1]] : [surahs[i]];
          items.push({
            type: 'surah-row',
            surahs: pair,
            key: `card-${pair.map(s => s.id).join('-')}`,
          });
        }
      } else if (showJuzHeaders) {
        let currentJuz: number | null = null;
        for (const surah of surahs) {
          const juz = getJuzForSurah(surah.id);
          if (juz !== currentJuz) {
            currentJuz = juz;
            stickies.push(items.length);
            items.push({
              type: 'juz-header',
              juzName: getJuzName(juz),
              key: `juz-${juz}`,
            });
          }
          items.push({
            type: 'surah-row',
            surahs: [surah],
            key: `surah-${surah.id}`,
          });
        }
      } else {
        for (const surah of surahs) {
          items.push({
            type: 'surah-row',
            surahs: [surah],
            key: `surah-${surah.id}`,
          });
        }
      }

      return {data: items, stickyIndices: stickies};
    }, [surahs, viewMode, sortOption]);

    // Render a card item (used by inline mode)
    const renderCardItem = React.useCallback(
      ({item}: {item: Surah}) => (
        <SurahCard
          id={item.id}
          name={item.name}
          translatedName={item.translated_name_english}
          versesCount={item.verses_count}
          revelationPlace={item.revelation_place}
          color={getColorForSurah(item.id)}
          onPress={() => onSurahPress(item)}
          style={styles.surahCard}
          isLoved={isLoved(reciterId, item.id.toString())}
          isDownloaded={isDownloaded(reciterId, item.id.toString())}
          onOptionsPress={() => onOptionsPress && onOptionsPress(item)}
          reciterId={reciterId}
          rewayatId={rewayatId}
        />
      ),
      [
        getColorForSurah,
        onSurahPress,
        styles.surahCard,
        isLoved,
        isDownloaded,
        reciterId,
        onOptionsPress,
        rewayatId,
      ],
    );

    // Unified FlashList render function
    const renderItem = React.useCallback(
      ({item}: ListRenderItemInfo<FlatItem>) => {
        if (item.type === 'juz-header') {
          return (
            <View
              style={[
                styles.juzHeader,
                {backgroundColor: theme.colors.background},
              ]}>
              <Text
                style={[
                  styles.juzHeaderText,
                  {color: theme.colors.textSecondary},
                ]}>
                {item.juzName}
              </Text>
            </View>
          );
        }

        const itemSurahs = item.surahs;
        if (viewMode === 'card') {
          return (
            <View style={styles.cardRow}>
              {itemSurahs.map(surah => (
                <SurahCard
                  key={surah.id}
                  id={surah.id}
                  name={surah.name}
                  translatedName={surah.translated_name_english}
                  versesCount={surah.verses_count}
                  revelationPlace={surah.revelation_place}
                  color={getColorForSurah(surah.id)}
                  onPress={() => onSurahPress(surah)}
                  style={styles.surahCard}
                  isLoved={isLoved(reciterId, surah.id.toString())}
                  isDownloaded={isDownloaded(reciterId, surah.id.toString())}
                  onOptionsPress={() => onOptionsPress && onOptionsPress(surah)}
                  reciterId={reciterId}
                  rewayatId={rewayatId}
                />
              ))}
              {itemSurahs.length === 1 && <View style={styles.surahCard} />}
            </View>
          );
        }

        return (
          <SurahItem
            item={itemSurahs[0]}
            onPress={onSurahPress}
            reciterId={reciterId}
            isLoved={isLoved(reciterId, itemSurahs[0].id.toString())}
            isDownloaded={isDownloaded(reciterId, itemSurahs[0].id.toString())}
            onOptionsPress={onOptionsPress}
            rewayatId={rewayatId}
          />
        );
      },
      [
        viewMode,
        getColorForSurah,
        onSurahPress,
        reciterId,
        isLoved,
        isDownloaded,
        onOptionsPress,
        rewayatId,
        styles,
        theme.colors,
      ],
    );

    // Render a list item for inline mode
    const renderInlineListItem = React.useCallback(
      (item: FlatItem) => {
        if (item.type === 'juz-header') {
          return (
            <View style={styles.juzHeader}>
              <Text
                style={[
                  styles.juzHeaderText,
                  {color: theme.colors.textSecondary},
                ]}>
                {item.juzName}
              </Text>
            </View>
          );
        }
        return (
          <SurahItem
            item={item.surahs[0]}
            onPress={onSurahPress}
            reciterId={reciterId}
            isLoved={isLoved(reciterId, item.surahs[0].id.toString())}
            isDownloaded={isDownloaded(reciterId, item.surahs[0].id.toString())}
            onOptionsPress={onOptionsPress}
            rewayatId={rewayatId}
          />
        );
      },
      [
        onSurahPress,
        reciterId,
        isLoved,
        isDownloaded,
        onOptionsPress,
        rewayatId,
        styles.juzHeader,
        styles.juzHeaderText,
        theme.colors.textSecondary,
      ],
    );

    const keyExtractor = React.useCallback((item: FlatItem) => item.key, []);

    const getItemType = React.useCallback((item: FlatItem) => item.type, []);

    // Batched inline rendering — render first batch immediately, rest after interactions
    const INITIAL_CARD_BATCH = 12;
    const INITIAL_LIST_BATCH = 20;

    const [expandedCards, setExpandedCards] = React.useState(false);
    const [expandedList, setExpandedList] = React.useState(false);

    React.useEffect(() => {
      if (!inline) return;
      const handle = InteractionManager.runAfterInteractions(() => {
        setExpandedCards(true);
        setExpandedList(true);
      });
      return () => handle.cancel();
    }, [inline]);

    // Inline rendering mode: no FlashList, items rendered directly in parent ScrollView
    if (inline) {
      if (viewMode === 'card') {
        const visibleSurahs = expandedCards
          ? surahs
          : surahs.slice(0, INITIAL_CARD_BATCH);
        return (
          <View style={styles.surahsContainer}>
            {surahs.length === 0 ? (
              <Text style={styles.emptyText}>No surahs available</Text>
            ) : (
              <View style={styles.cardGrid}>
                {visibleSurahs.map(surah => (
                  <React.Fragment key={`card-${surah.id}`}>
                    {renderCardItem({item: surah})}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        );
      }

      const visibleData = expandedList
        ? data
        : data.slice(0, INITIAL_LIST_BATCH);
      return (
        <View style={styles.surahsContainer}>
          {data.length === 0 ? (
            <Text style={styles.emptyText}>No surahs available</Text>
          ) : (
            visibleData.map((item, index) => (
              <React.Fragment key={item.key}>
                {renderInlineListItem(item)}
                {index < visibleData.length - 1 && <ItemSeparator />}
              </React.Fragment>
            ))
          )}
        </View>
      );
    }

    return (
      <View style={styles.surahsContainer}>
        <FlashList
          ref={ref}
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          stickyHeaderIndices={stickyIndices}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent ?? undefined}
          onScroll={onScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            contentContainerStyle as {paddingBottom?: number}
          }
          drawDistance={moderateScale(300)}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No surahs available</Text>
          }
        />
      </View>
    );
  },
);

// Add display name
SurahList.displayName = 'SurahList';

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    surahsContainer: {
      flex: 1,
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(12),
    },
    surahCard: {
      width: '48%',
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      rowGap: moderateScale(16),
    },
    listSeparator: {
      height: moderateScale(4),
    },
    emptyText: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: moderateScale(20),
    },
    juzHeader: {
      paddingHorizontal: moderateScale(16),
      paddingTop: moderateScale(14),
      paddingBottom: moderateScale(6),
    },
    juzHeaderText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
  });
