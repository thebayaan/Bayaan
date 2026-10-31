import React, {useCallback, useRef, useState} from 'react'; // @ai
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent, // @ai
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  SheetProps,
  ScrollView,
  type ActionSheetRef, // @ai
} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {useNativeSheetId} from '@/components/native/nativeSheetContext'; // @ai
import {
  createStyles,
  MushafLayoutPanel,
  MUSHAF_SHEET_HEIGHT_RATIO,
} from './MushafLayoutPanel'; // @ai

// @ai-start
/**
 * On a phone the sheet opens at its lower snap point, about half the
 * window, so the page stays visible; opening a card snaps it to the top.
 */
export const PHONE_SNAP_POINTS = [60, 100];

/**
 * Height of the content area the sheet shows at snap point `index`: the
 * visible share of the sheet minus the chrome above the content (padding
 * and the drag handle). At the lower point the bottom of the sheet sits
 * below the screen, so the content is cut to what shows and scrolls
 * inside it; every row stays reachable without dragging the sheet up.
 */
export function visibleContentHeight(
  sheetHeight: number,
  contentHeight: number,
  index: number,
): number | undefined {
  const point = PHONE_SNAP_POINTS[index];
  if (point === undefined || point >= 100 || contentHeight <= 0) {
    return undefined;
  }
  const chrome = Math.max(0, sheetHeight - contentHeight);
  return Math.max(0, (sheetHeight * point) / 100 - chrome);
}

export const MushafLayoutSheet = (props: SheetProps<'mushaf-layout'>) => {
  const {theme} = useTheme();
  const {isTablet} = useResponsive();
  const inNativeSheet = useNativeSheetId() !== null;
  // Height follows the current window (the Mushaf rotates), not the one at
  // import time, which overflowed the screen in landscape.
  const {height: windowHeight} = useWindowDimensions();
  const styles = createStyles(theme, windowHeight);
  const [resetKey, setResetKey] = useState(0);
  const sheetRef = useRef<ActionSheetRef>(null);
  const snaps = !isTablet && !inNativeSheet;
  const [snapIndex, setSnapIndex] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const grow = useCallback(() => sheetRef.current?.snapToIndex(1), []);
  const shrink = useCallback(() => sheetRef.current?.snapToIndex(0), []);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  }, []);
  const bounded = snaps
    ? visibleContentHeight(
        windowHeight * MUSHAF_SHEET_HEIGHT_RATIO,
        contentHeight,
        snapIndex,
      )
    : undefined;

  return (
    <ActionSheet
      ref={sheetRef}
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      snapPoints={snaps ? PHONE_SNAP_POINTS : undefined}
      initialSnapIndex={snaps ? 0 : undefined}
      onSnapIndexChange={snaps ? setSnapIndex : undefined}
      onClose={() => {
        setResetKey(key => key + 1);
        setSnapIndex(0);
      }}>
      {/* The full content area, measured; the panel inside it is cut to
          the part of the sheet on screen. */}
      <View
        style={snaps ? styles.fill : undefined}
        onLayout={snaps ? onContentLayout : undefined}>
        <View
          style={bounded === undefined ? styles.fill : {height: bounded}}
          testID="mushaf-layout-content">
          <MushafLayoutPanel
            key={resetKey}
            context={props.payload?.context}
            ScrollComponent={ScrollView}
            onGrow={snaps ? grow : undefined}
            onShrink={snaps ? shrink : undefined}
            inLibrarySheet={!inNativeSheet}
          />
        </View>
      </View>
    </ActionSheet>
  );
};

// @ai-end
