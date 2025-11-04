import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {LegendList} from '@legendapp/list';
import {Reciter} from '@/data/reciterData';
import {Theme} from '@/utils/themeUtils';
import {BrowseReciterCard} from './BrowseReciterCard';

interface BrowseGridProps {
  reciters: Reciter[];
  onReciterPress: (reciter: Reciter) => void;
  theme: Theme;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}

function createStyles(_theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      paddingHorizontal: moderateScale(10),
      paddingBottom: moderateScale(80),
      paddingTop: moderateScale(8),
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: moderateScale(10),
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
  ({reciters, onReciterPress, theme}: BrowseGridProps) => {
    const {width: windowWidth} = useWindowDimensions();
    const [isLoading] = useState(false);

    // Calculate number of columns based on screen width
    const numColumns = useMemo(() => {
      const minCardWidth = moderateScale(120);
      return Math.max(3, Math.floor(windowWidth / minCardWidth));
    }, [windowWidth]);

    // Convert flat list to rows for grid layout
    const itemRows = useMemo(() => {
      return createItemRows(reciters, numColumns);
    }, [reciters, numColumns]);

    const styles = useMemo(() => createStyles(theme), [theme]);

    // Calculate item dimensions
    const itemDimensions = useMemo(() => {
      const totalHorizontalPadding = moderateScale(16);
      const gapSpace = moderateScale(10) * (numColumns - 1);
      const availableWidth = windowWidth - totalHorizontalPadding - gapSpace;
      const itemWidth = availableWidth / numColumns;
      const itemHeight = itemWidth * 1.2;

      return {
        width: itemWidth,
        height: itemHeight,
      };
    }, [windowWidth, numColumns]);

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
      [itemDimensions, onReciterPress, theme, numColumns, styles.row],
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
      <View style={styles.container}>
        <LegendList
          data={itemRows}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.gridContainer}
          estimatedItemSize={itemDimensions.height}
          recycleItems
          drawDistance={2000}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
          waitForInitialLayout
          onEndReachedThreshold={0.5}
          maintainVisibleContentPosition
        />
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.theme === nextProps.theme &&
    prevProps.onReciterPress === nextProps.onReciterPress &&
    prevProps.reciters.length === nextProps.reciters.length,
);

BrowseGrid.displayName = 'BrowseGrid';

export default BrowseGrid;
