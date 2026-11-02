import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import {moderateScale} from '@/utils/scale';
import {LegendList} from '@legendapp/list';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {BrowseReciterCard, TABLET_CAPTION_HEIGHT} from './BrowseReciterCard'; // @ai
import {computeGridLayout} from '@/utils/gridLayout'; // @ai
import type {ReciterProfilePathname} from '@/hooks/useTabReciterPath'; // @ai

interface BrowseGridProps {
  reciters: Reciter[];
  onReciterPress: (reciter: Reciter) => void;
  theme: Theme;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  onScrollBeginDrag?: () => void;
  getRewayatIdForReciter?: (reciter: Reciter) => string | undefined;
  // False when tapping a card should call `onReciterPress` instead of
  // opening the reciter's profile (e.g. choosing a reciter for a surah).
  linkToProfile?: boolean; // @ai
  // Profile route for the tab showing the grid (Home when omitted). @ai
  profilePathname?: ReciterProfilePathname;
  // Optional bottom inset to clear the floating mini-player + tab bar.
  // Callers compute via `useBottomInset` so the last grid row stays
  // tappable when the mini-player is visible. Defaults to 0 for callers
  // that don't need it; the original `moderateScale(80)` floor still
  // applies when the inset is small or unset.
  bottomInset?: number;
  // iPad page margin. When set, the grid uses the tablet layout: 160pt
  // minimum cards with 16pt gutters, square art and 14/12pt captions, and
  // a play badge on cards whose tap plays (mockup L8). @ai
  tabletMargin?: number;
}

// @ai-start
// One source for the padding and gap so the column math matches the styles.
const GRID_PADDING = moderateScale(10);
const GRID_GAP = moderateScale(10);
// Tablet grid in plain points (ipad-standards §10.1): 3-5 columns on iPad.
const TABLET_MIN_CARD_WIDTH = 160;
const TABLET_GAP = 16;
const TABLET_ROW_GAP = 20;
// @ai-end

function createStyles(_theme: Theme, bottomInset = 0, tabletMargin?: number) {
  const isTabletLayout = tabletMargin !== undefined; // @ai
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      paddingHorizontal: tabletMargin ?? GRID_PADDING, // @ai
      paddingBottom: Math.max(moderateScale(80), bottomInset),
      paddingTop: moderateScale(8),
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: isTabletLayout ? TABLET_ROW_GAP : moderateScale(10), // @ai
    },
    loadingContainer: {
      padding: moderateScale(20),
      alignItems: 'center',
    },
  });
}

// Create rows of items for grid layout
const createItemRows = (
  reciters: Reciter[],
  numColumns: number,
): Array<Reciter[]> => {
  const rows: Array<Reciter[]> = [];
  for (let i = 0; i < reciters.length; i += numColumns) {
    rows.push(reciters.slice(i, i + numColumns));
  }
  return rows;
};

const BrowseGrid = React.memo(
  ({
    reciters,
    onReciterPress,
    theme,
    keyboardShouldPersistTaps = 'handled',
    onScrollBeginDrag,
    getRewayatIdForReciter,
    linkToProfile = true, // @ai
    profilePathname, // @ai
    bottomInset = 0,
    tabletMargin, // @ai
  }: BrowseGridProps) => {
    const {width: windowWidth} = useWindowDimensions();
    const [isLoading] = useState(false);
    // @ai-start
    // Size the grid from its own container, not the window: on iPad it sits
    // beside the sidebar inside a capped column. The window width is only a
    // first guess until onLayout reports.
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.width;
      setContainerWidth(prev => (prev === next ? prev : next));
    }, []);
    const gridWidth = containerWidth ?? windowWidth;

    const isTabletLayout = tabletMargin !== undefined;
    const {numColumns, itemWidth} = useMemo(
      () =>
        tabletMargin !== undefined
          ? computeGridLayout(gridWidth, {
              minCardWidth: TABLET_MIN_CARD_WIDTH,
              horizontalPadding: tabletMargin,
              gap: TABLET_GAP,
              minColumns: 2,
            })
          : computeGridLayout(gridWidth, {
              minCardWidth: moderateScale(120),
              horizontalPadding: GRID_PADDING,
              gap: GRID_GAP,
              minColumns: 3,
            }),
      [gridWidth, tabletMargin],
    );
    // @ai-end

    // Convert flat list to rows for grid layout
    const itemRows = useMemo(() => {
      return createItemRows(reciters, numColumns);
    }, [reciters, numColumns]);

    const styles = useMemo(
      () => createStyles(theme, bottomInset, tabletMargin),
      [theme, bottomInset, tabletMargin],
    ); // @ai

    // @ai-start
    const itemDimensions = useMemo(
      () => ({
        width: itemWidth,
        height: isTabletLayout
          ? itemWidth + TABLET_CAPTION_HEIGHT
          : itemWidth * 1.2,
      }),
      [itemWidth, isTabletLayout],
    );
    // @ai-end

    // Render a row of items
    const renderRow = useCallback(
      ({item}: {item: Reciter[]}) => (
        <View style={styles.row}>
          {item.map(reciter => (
            <BrowseReciterCard
              key={reciter.id}
              reciter={reciter}
              onPress={() => onReciterPress(reciter)}
              width={itemDimensions.width}
              height={itemDimensions.height}
              theme={theme}
              rewayatId={getRewayatIdForReciter?.(reciter)}
              linkToProfile={linkToProfile}
              profilePathname={profilePathname} // @ai
              tabletText={isTabletLayout} // @ai
              showPlayBadge={isTabletLayout && !linkToProfile} // @ai
            />
          ))}
          {/* Add empty placeholders for the last row if needed */}
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
      [
        itemDimensions,
        onReciterPress,
        theme,
        numColumns,
        styles.row,
        getRewayatIdForReciter,
        linkToProfile, // @ai
        profilePathname, // @ai
        isTabletLayout, // @ai
      ],
    );

    const keyExtractor = useCallback(
      (item: Reciter[], index: number) => `row-${index}`,
      [],
    );

    const renderFooter = useCallback(() => {
      if (!isLoading) return null;

      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.text} />
        </View>
      );
    }, [isLoading, styles.loadingContainer, theme.colors.text]);

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
            estimatedItemSize={itemDimensions.height}
            recycleItems
            drawDistance={2000}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={renderFooter}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
  (prevProps, nextProps) =>
    prevProps.theme === nextProps.theme &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    // Compare the list itself: a filter can return different reciters with
    // the same count (e.g. switching rāwī), which must re-render.
    prevProps.reciters === nextProps.reciters && // @ai
    prevProps.getRewayatIdForReciter === nextProps.getRewayatIdForReciter &&
    prevProps.linkToProfile === nextProps.linkToProfile && // @ai
    prevProps.profilePathname === nextProps.profilePathname && // @ai
    prevProps.bottomInset === nextProps.bottomInset &&
    prevProps.tabletMargin === nextProps.tabletMargin && // @ai
    prevProps.keyboardShouldPersistTaps === nextProps.keyboardShouldPersistTaps,
);

BrowseGrid.displayName = 'BrowseGrid';

export default BrowseGrid;
