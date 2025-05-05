import React from 'react';
import {Text, Animated, View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {SurahListProps} from '@/components/reciter-profile/types';
import {SurahItem} from '@/components/SurahItem';
import {SurahCard} from '@/components/cards/SurahCard';
import {Surah} from '@/data/surahData';

// Define types matching useSettings and ReciterProfile
type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation'; // Include revelation order

// Update props interface (consider moving this to types/reciter-profile.ts)
interface UpdatedSurahListProps extends SurahListProps {
  viewMode: ReciterProfileViewMode;
  getColorForSurah: (id: number) => string;
  sortOption: ReciterProfileSortOption;
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
      onOptionsPress,
      onScroll,
      ListHeaderComponent,
      contentContainerStyle,
      viewMode,
      getColorForSurah,
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

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
          onOptionsPress={() => onOptionsPress && onOptionsPress(item)}
        />
      ),
      [
        getColorForSurah,
        onSurahPress,
        styles.surahCard,
        isLoved,
        reciterId,
        onOptionsPress,
      ],
    );

    // Render a list item using SurahItem
    const renderListItem = React.useCallback(
      ({item}: {item: Surah}) => (
        <SurahItem
          item={item}
          onPress={onSurahPress}
          reciterId={reciterId}
          isLoved={isLoved(reciterId, item.id.toString())}
          onOptionsPress={onOptionsPress}
        />
      ),
      [onSurahPress, reciterId, isLoved, onOptionsPress],
    );

    // Shared ListHeader to avoid re-rendering issues
    const HeaderMemo = React.useMemo(
      () => ListHeaderComponent,
      [ListHeaderComponent],
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
            data={surahs}
            renderItem={renderCardItem}
            keyExtractor={item => `card-${item.id}`}
            ListHeaderComponent={HeaderMemo}
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
            data={surahs}
            renderItem={renderListItem}
            keyExtractor={item => `list-${item.id}`}
            ListHeaderComponent={HeaderMemo}
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
  });
