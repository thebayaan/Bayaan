import React, {useMemo, useCallback, useState} from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {moderateScale as moderateScaleCapped} from '@/utils/scale';
import {LegendList, type LegendListRenderItemProps} from '@legendapp/list';
import {Theme} from '@/utils/themeUtils';
import {PlaylistCard} from '@/components/cards/PlaylistCard';
import {CircularReciterCard} from '@/components/cards/CircularReciterCard';
import {LovedCard} from '@/components/cards/LovedCard';
import {DownloadCard} from '@/components/cards/DownloadCard';
import {TrackCard} from '@/components/cards/TrackCard';
import {ReciterDownloadsStackCard} from '@/components/cards/ReciterDownloadsStackCard';
import {UploadCard} from '@/components/cards/UploadCard';
import {computeGridLayout} from '@/utils/gridLayout';

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

export interface ReciterDownloadsItemData {
  reciterId: string;
  downloadCount: number;
  onPress: () => void;
}

export interface UploadItemData {
  itemCount: number;
  onPress: () => void;
}

export interface CollectionItem {
  id: string;
  type:
    | 'playlist'
    | 'loved'
    | 'reciter'
    | 'download'
    | 'track'
    | 'reciter-downloads'
    | 'upload';
  data:
    | PlaylistItemData
    | LovedItemData
    | ReciterItemData
    | DownloadItemData
    | TrackItemData
    | ReciterDownloadsItemData
    | UploadItemData;
}

interface CollectionGridProps {
  items: CollectionItem[];
  theme: Theme;
  onScrollBeginDrag?: () => void;
  // Optional bottom inset to clear the floating mini-player + tab bar.
  // Callers compute via `useBottomInset` so the last grid row stays
  // tappable when the mini-player is visible. Defaults to 0 for callers
  // that don't need it; the original `moderateScale(80)` floor still
  // applies when the inset is small or unset.
  bottomInset?: number;
}

// @ai-start
// One source for the padding and gap so the column math matches the styles.
const GRID_PADDING = moderateScale(16);
const GRID_GAP = moderateScale(10);
// @ai-end

function createStyles(_theme: Theme, bottomInset = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      paddingHorizontal: GRID_PADDING, // @ai
      paddingBottom: Math.max(moderateScaleCapped(80), bottomInset),
      paddingTop: moderateScale(8),
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: GRID_GAP, // @ai
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
  ({items, theme, onScrollBeginDrag, bottomInset = 0}: CollectionGridProps) => {
    const {width: windowWidth} = useWindowDimensions();
    // @ai-start
    // Size the grid from its own container, not the window: on iPad it sits
    // beside the sidebar inside a capped column, so window math overflowed
    // and clipped the last column. Same approach as BrowseGrid.
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.width;
      setContainerWidth(prev => (prev === next ? prev : next));
    }, []);
    const gridWidth = containerWidth ?? windowWidth;

    const {numColumns, itemWidth} = useMemo(
      () =>
        computeGridLayout(gridWidth, {
          minCardWidth: moderateScale(120),
          horizontalPadding: GRID_PADDING,
          gap: GRID_GAP,
          minColumns: 3,
        }),
      [gridWidth],
    );
    // @ai-end

    // Convert flat list to rows for grid layout
    const itemRows = useMemo(() => {
      return createItemRows(items, numColumns);
    }, [items, numColumns]);

    const styles = useMemo(
      () => createStyles(theme, bottomInset),
      [theme, bottomInset],
    );

    // Same ratio as BrowseGrid
    const itemDimensions = useMemo(
      () => ({width: itemWidth, height: itemWidth * 1.2}), // @ai
      [itemWidth],
    );

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
          case 'reciter-downloads': {
            const reciterDownloadsData = item.data as ReciterDownloadsItemData;
            return (
              <ReciterDownloadsStackCard
                key={item.id}
                reciterId={reciterDownloadsData.reciterId}
                downloadCount={reciterDownloadsData.downloadCount}
                onPress={reciterDownloadsData.onPress}
                width={itemDimensions.width}
                height={itemDimensions.width}
              />
            );
          }
          case 'upload': {
            const uploadData = item.data as UploadItemData;
            return (
              <UploadCard
                key={item.id}
                itemCount={uploadData.itemCount}
                onPress={uploadData.onPress}
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
      ({item}: LegendListRenderItemProps<CollectionItem[]>) => (
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
      <View style={styles.container} onLayout={handleLayout}>
        {/* @ai-start */}
        {/* Wait for the measured width: LegendList recycles rows drawn at the
            window-width guess and keeps them stale after onLayout reports.
            extraData redraws rows when the width changes later (rotation,
            Split View). */}
        {containerWidth !== null && (
          <LegendList
            data={itemRows}
            extraData={itemDimensions}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.gridContainer}
            scrollIndicatorInsets={{bottom: bottomInset}}
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
        )}
        {/* @ai-end */}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Don't re-render if theme hasn't changed and items array reference is the same
    // Since items is memoized, the reference will change when any item data changes
    return (
      prevProps.theme === nextProps.theme &&
      prevProps.items === nextProps.items &&
      prevProps.bottomInset === nextProps.bottomInset
    );
  },
);

CollectionGrid.displayName = 'CollectionGrid';
