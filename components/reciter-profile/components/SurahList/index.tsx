import React, {useMemo} from 'react';
import {Text, Animated, View, SectionList} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import {SurahListProps} from '@/components/reciter-profile/types';
import {SurahItem} from '@/components/SurahItem';
import {SurahCard} from '@/components/cards/SurahCard';
import {JuzSectionHeader} from '@/components/JuzSectionHeader';
import {Surah} from '@/data/surahData';
import {groupSurahsByJuz, JuzSection} from '@/data/juzData';

// Define types matching useSettings and ReciterProfile
type ReciterProfileViewMode = 'card' | 'list';
type ReciterProfileSortOption = 'asc' | 'desc' | 'revelation' | 'juz';

// Update props interface
interface UpdatedSurahListProps extends SurahListProps {
  viewMode: ReciterProfileViewMode;
  getColorForSurah: (id: number) => string;
  sortOption: ReciterProfileSortOption;
  rewayatId?: string;
}

// Shared ItemSeparator component
const ItemSeparator = React.memo(() => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  return <View style={styles.listSeparator} />;
});
ItemSeparator.displayName = 'ItemSeparator';

// Card row component for card grid in section list
const CardRow = React.memo(
  ({
    surahs,
    onSurahPress,
    reciterId,
    isLoved,
    isDownloaded,
    onOptionsPress,
    getColorForSurah,
    rewayatId,
    styles,
  }: {
    surahs: Surah[];
    onSurahPress: (surah: Surah) => void;
    reciterId: string;
    isLoved: (id: string, surahId: string | number) => boolean;
    isDownloaded: (id: string, surahId: string | number) => boolean;
    onOptionsPress?: (surah: Surah) => void;
    getColorForSurah: (id: number) => string;
    rewayatId?: string;
    styles: ReturnType<typeof createStyles>;
  }) => (
    <View style={styles.cardRow}>
      {surahs.map(surah => (
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
          onOptionsPress={onOptionsPress ? () => onOptionsPress(surah) : undefined}
          reciterId={reciterId}
          rewayatId={rewayatId}
        />
      ))}
      {/* Add placeholder if odd number of cards */}
      {surahs.length === 1 && <View style={styles.surahCard} />}
    </View>
  ),
);
CardRow.displayName = 'CardRow';

/**
 * SurahList component for the ReciterProfile
 *
 * Displays surahs in either a list or grid view.
 * Supports grouping by Juz when sortOption is 'juz'.
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
      contentContainerStyle,
      viewMode,
      sortOption,
      getColorForSurah,
      rewayatId,
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = createStyles(theme);

    // Group surahs by Juz for juz sort option
    const juzSections = useMemo(() => {
      if (sortOption !== 'juz') return [];
      return groupSurahsByJuz(surahs);
    }, [surahs, sortOption]);

    // Prepare card rows for Juz sections (2 cards per row)
    const juzCardSections = useMemo(() => {
      if (sortOption !== 'juz' || viewMode !== 'card') return [];

      return juzSections.map(section => {
        // Group surahs into rows of 2
        const rows: Surah[][] = [];
        for (let i = 0; i < section.data.length; i += 2) {
          rows.push(section.data.slice(i, i + 2));
        }
        return {
          ...section,
          data: rows,
        };
      });
    }, [juzSections, viewMode, sortOption]);

    // Render a card item for FlatList
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
          onOptionsPress={onOptionsPress ? () => onOptionsPress(item) : undefined}
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

    // Render a list item using SurahItem
    const renderListItem = React.useCallback(
      ({item}: {item: Surah}) => (
        <SurahItem
          item={item}
          onPress={onSurahPress}
          reciterId={reciterId}
          isLoved={isLoved(reciterId, item.id.toString())}
          isDownloaded={isDownloaded(reciterId, item.id.toString())}
          onOptionsPress={onOptionsPress}
          rewayatId={rewayatId}
        />
      ),
      [onSurahPress, reciterId, isLoved, isDownloaded, onOptionsPress, rewayatId],
    );

    // Render section header for Juz
    const renderSectionHeader = React.useCallback(
      ({section}: {section: JuzSection<Surah> | JuzSection<Surah[]>}) => (
        <JuzSectionHeader
          juzNumber={section.juzNumber}
          juzName={section.juzName}
          juzArabicName={section.juzArabicName}
          surahCount={
            Array.isArray(section.data[0])
              ? (section.data as Surah[][]).reduce((acc, row) => acc + row.length, 0)
              : section.data.length
          }
        />
      ),
      [],
    );

    // Render card row for SectionList
    const renderCardRow = React.useCallback(
      ({item}: {item: Surah[]}) => (
        <CardRow
          surahs={item}
          onSurahPress={onSurahPress}
          reciterId={reciterId}
          isLoved={isLoved}
          isDownloaded={isDownloaded}
          onOptionsPress={onOptionsPress}
          getColorForSurah={getColorForSurah}
          rewayatId={rewayatId}
          styles={styles}
        />
      ),
      [onSurahPress, reciterId, isLoved, isDownloaded, onOptionsPress, getColorForSurah, rewayatId, styles],
    );

    // Shared ListHeader to avoid re-rendering issues
    const HeaderMemo = React.useMemo(
      () => ListHeaderComponent,
      [ListHeaderComponent],
    );

    // Shared content container style
    const sharedContentContainerStyle = React.useMemo(
      () => [styles.listContentContainer, contentContainerStyle],
      [styles.listContentContainer, contentContainerStyle],
    );

    // If sortOption is 'juz', use SectionList
    if (sortOption === 'juz') {
      return (
        <View style={styles.surahsContainer}>
          {/* Card View with Juz sections */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'card' && styles.hiddenView,
            ]}>
            <SectionList
              sections={juzCardSections}
              renderItem={renderCardRow}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={(item, index) =>
                `juz-card-row-${item.map(s => s.id).join('-')}-${index}`
              }
              ListHeaderComponent={HeaderMemo}
              onScroll={viewMode === 'card' ? onScroll : undefined}
              scrollEventThrottle={16}
              contentContainerStyle={sharedContentContainerStyle}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
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

          {/* List View with Juz sections */}
          <View
            style={[
              styles.viewContainer,
              viewMode !== 'list' && styles.hiddenView,
            ]}>
            <SectionList
              sections={juzSections}
              renderItem={renderListItem}
              renderSectionHeader={renderSectionHeader}
              keyExtractor={item => `juz-list-${item.id}`}
              ListHeaderComponent={HeaderMemo}
              onScroll={viewMode === 'list' ? onScroll : undefined}
              scrollEventThrottle={16}
              contentContainerStyle={sharedContentContainerStyle}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
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
    }

    // For other sort options, use FlatList
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
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(16),
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
