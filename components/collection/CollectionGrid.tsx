import React, {useMemo, useCallback} from 'react';
import {View, StyleSheet, useWindowDimensions} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LegendList} from '@legendapp/list';
import {Theme} from '@/utils/themeUtils';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {LovedCard} from '@/components/cards/LovedCard';
import {DownloadCard} from '@/components/cards/DownloadCard';
import {TrackCard} from '@/components/cards/TrackCard';

export interface PlaylistItemData {
  name: string;
  itemCount: number;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

export interface LovedItemData {
  itemCount: number;
  onPress: () => void;
}

export interface ReciterItemData {
  image_url: string | null;
  name: string;
  onPress: () => void;
}

export interface DownloadItemData {
  itemCount: number;
  onPress: () => void;
}

export interface TrackItemData {
  reciterId: string;
  surahId: string;
  rewayatId?: string;
  onPress: () => void;
}

export interface CollectionItem {
  id: string;
  type: 'playlist' | 'loved' | 'reciter' | 'download' | 'track';
  data:
    | PlaylistItemData
    | LovedItemData
    | ReciterItemData
    | DownloadItemData
    | TrackItemData;
}

interface CollectionGridProps {
  items: CollectionItem[];
  theme: Theme;
  onScrollBeginDrag?: () => void;
}

function createStyles(_theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(80),
      paddingTop: moderateScale(8),
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: moderateScale(10),
    },
  });
}

// Create rows of items for grid layout
const createItemRows = (
  items: CollectionItem[],
  numColumns: number,
): Array<CollectionItem[]> => {
  const rows: Array<CollectionItem[]> = [];
  for (let i = 0; i < items.length; i += numColumns) {
    rows.push(items.slice(i, i + numColumns));
  }
  return rows;
};

export const CollectionGrid = React.memo(
  ({items, theme, onScrollBeginDrag}: CollectionGridProps) => {
    const {width: windowWidth} = useWindowDimensions();

    // Calculate number of columns based on screen width (same as BrowseGrid)
    const numColumns = useMemo(() => {
      const minCardWidth = moderateScale(120);
      const calculated = Math.floor(windowWidth / minCardWidth);
      return Math.max(3, calculated);
    }, [windowWidth]);

    // Convert flat list to rows for grid layout
    const itemRows = useMemo(() => {
      return createItemRows(items, numColumns);
    }, [items, numColumns]);

    const styles = useMemo(() => createStyles(theme), [theme]);

    // Calculate item dimensions (same as BrowseGrid)
    const itemDimensions = useMemo(() => {
      const totalHorizontalPadding = moderateScale(32); // paddingHorizontal * 2
      const gapSpace = moderateScale(10) * (numColumns - 1);
      const availableWidth = windowWidth - totalHorizontalPadding - gapSpace;
      const itemWidth = availableWidth / numColumns;
      const itemHeight = itemWidth * 1.2; // Same ratio as BrowseGrid

      return {
        width: itemWidth,
        height: itemHeight,
      };
    }, [windowWidth, numColumns]);

    // Render individual card based on type
    const renderCard = useCallback(
      (item: CollectionItem) => {
        switch (item.type) {
          case 'playlist': {
            const playlistData = item.data as PlaylistItemData;
            return (
              <PlaylistCard
                key={item.id}
                name={playlistData.name}
                itemCount={playlistData.itemCount}
                color={playlistData.color}
                onPress={playlistData.onPress}
                onLongPress={playlistData.onLongPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          case 'loved': {
            const lovedData = item.data as LovedItemData;
            return (
              <LovedCard
                key={item.id}
                itemCount={lovedData.itemCount}
                onPress={lovedData.onPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          case 'reciter': {
            const reciterData = item.data as ReciterItemData;
            return (
              <CircularReciterCard
                key={item.id}
                imageUrl={reciterData.image_url ?? undefined}
                name={reciterData.name}
                onPress={reciterData.onPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          case 'download': {
            const downloadData = item.data as DownloadItemData;
            return (
              <DownloadCard
                key={item.id}
                itemCount={downloadData.itemCount}
                onPress={downloadData.onPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          case 'track': {
            const trackData = item.data as TrackItemData;
            return (
              <TrackCard
                key={item.id}
                reciterId={trackData.reciterId}
                surahId={trackData.surahId}
                rewayatId={trackData.rewayatId}
                onPress={trackData.onPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          default:
            return null;
        }
      },
      [itemDimensions],
    );

    // Render a row of items
    const renderRow = useCallback(
      ({item}: {item: CollectionItem[]}) => (
        <View style={styles.row}>
          {item.map(collectionItem => renderCard(collectionItem))}
          {/* Add empty placeholders for incomplete rows */}
          {item.length < numColumns &&
            Array(numColumns - item.length)
              .fill(null)
              .map((_, index) => (
                <View
                  key={`placeholder-${index}`}
                  style={{width: itemDimensions.width}}
                />
              ))}
        </View>
      ),
      [renderCard, styles.row, numColumns, itemDimensions.width],
    );

    const keyExtractor = useCallback(
      (item: CollectionItem[], index: number) => `row-${index}`,
      [],
    );

    return (
      <View style={styles.container}>
        <LegendList
          data={itemRows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.gridContainer}
          estimatedItemSize={moderateScale(140)}
          recycleItems
          drawDistance={2000}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          waitForInitialLayout
          onEndReachedThreshold={0.5}
          maintainVisibleContentPosition
          onScrollBeginDrag={onScrollBeginDrag}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Don't re-render if theme hasn't changed and items array reference is the same
    // Since items is memoized, the reference will change when any item data changes
    return (
      prevProps.theme === nextProps.theme && prevProps.items === nextProps.items
    );
  },
);

CollectionGrid.displayName = 'CollectionGrid';
