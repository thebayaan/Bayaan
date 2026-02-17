import React from 'react';
import {Text, Animated, View, InteractionManager} from 'react-native';
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

// Type for list items - can be either a Juz header or surah
type ListItem =
  | {type: 'juz-header'; juzNumber: number; juzName: string}
  | {type: 'surah'; surah: Surah};

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
  Animated.FlatList,
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

    // Prepare list data with Juz headers when in list view with asc/desc sort
    const listData = React.useMemo(() => {
      const shouldShowJuzHeaders =
        viewMode === 'list' && (sortOption === 'asc' || sortOption === 'desc');

      if (!shouldShowJuzHeaders) {
        // No Juz headers - just return surahs wrapped in ListItem type
        return surahs.map(surah => ({type: 'surah' as const, surah}));
      }

      // Add Juz headers
      const data: ListItem[] = [];
      let currentJuz: number | null = null;

      surahs.forEach(surah => {
        const surahJuz = getJuzForSurah(surah.id);

        // Add Juz header when we encounter a new Juz
        if (surahJuz !== currentJuz) {
          currentJuz = surahJuz;
          data.push({
            type: 'juz-header',
            juzNumber: surahJuz,
            juzName: getJuzName(surahJuz),
          });
        }

        // Add the surah
        data.push({type: 'surah', surah});
      });

      return data;
    }, [surahs, viewMode, sortOption]);

    // Render a card item
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

    // Render a list item (surah or Juz header)
    const renderListItem = React.useCallback(
      ({item}: {item: ListItem}) => {
        // Handle Juz header
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

        // Handle surah
        return (
          <SurahItem
            item={item.surah}
            onPress={onSurahPress}
            reciterId={reciterId}
            isLoved={isLoved(reciterId, item.surah.id.toString())}
            isDownloaded={isDownloaded(reciterId, item.surah.id.toString())}
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

    // Key extractor for list items
    const listKeyExtractor = React.useCallback((item: ListItem) => {
      if (item.type === 'juz-header') {
        return `juz-${item.juzNumber}`;
      }
      return `list-${item.surah.id}`;
    }, []);

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

    // Inline rendering mode: no FlatList, items rendered directly in parent ScrollView
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

      const visibleListData = expandedList
        ? listData
        : listData.slice(0, INITIAL_LIST_BATCH);
      return (
        <View style={styles.surahsContainer}>
          {listData.length === 0 ? (
            <Text style={styles.emptyText}>No surahs available</Text>
          ) : (
            visibleListData.map((item, index) => (
              <React.Fragment key={listKeyExtractor(item)}>
                {renderListItem({item})}
                {index < visibleListData.length - 1 && <ItemSeparator />}
              </React.Fragment>
            ))
          )}
        </View>
      );
    }

    // Shared ListHeader to avoid re-rendering issues
    const HeaderMemo = React.useMemo(
      () => ListHeaderComponent,
      [ListHeaderComponent],
    );

    const FooterMemo = React.useMemo(
      () => ListFooterComponent ?? undefined,
      [ListFooterComponent],
    );

    // Important: We use the same exact contentContainerStyle for both views
    const sharedContentContainerStyle = React.useMemo(
      () => [styles.listContentContainer, contentContainerStyle],
      [styles.listContentContainer, contentContainerStyle],
    );

    return (
      <View style={styles.surahsContainer}>
        {/* Card View */}
        <View
          style={[
            styles.viewContainer,
            viewMode !== 'card' && styles.hiddenView,
          ]}>
          <Animated.FlatList
            ref={viewMode === 'card' ? ref : undefined}
            bounces={true}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            data={surahs}
            renderItem={renderCardItem}
            keyExtractor={item => `card-${item.id}`}
            ListHeaderComponent={HeaderMemo}
            ListFooterComponent={FooterMemo}
            onScroll={viewMode === 'card' ? onScroll : undefined}
            scrollEventThrottle={1}
            contentContainerStyle={sharedContentContainerStyle}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No surahs available</Text>
            }
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ItemSeparatorComponent={ItemSeparator}
          />
        </View>

        {/* List View */}
        <View
          style={[
            styles.viewContainer,
            viewMode !== 'list' && styles.hiddenView,
          ]}>
          <Animated.FlatList
            ref={viewMode === 'list' ? ref : undefined}
            bounces={true}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            data={listData}
            renderItem={renderListItem}
            keyExtractor={listKeyExtractor}
            ListHeaderComponent={HeaderMemo}
            ListFooterComponent={FooterMemo}
            onScroll={viewMode === 'list' ? onScroll : undefined}
            scrollEventThrottle={1}
            contentContainerStyle={sharedContentContainerStyle}
            numColumns={1}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No surahs available</Text>
            }
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            ItemSeparatorComponent={ItemSeparator}
          />
        </View>
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
    viewContainer: {
      width: '100%',
      flex: 1,
    },
    hiddenView: {
      display: 'none',
    },
    listContentContainer: {
      paddingBottom: moderateScale(80),
    },
    columnWrapper: {
      justifyContent: 'space-between',
      marginBottom: moderateScale(16),
      paddingHorizontal: moderateScale(16),
    },
    surahCard: {
      width: '47%',
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
