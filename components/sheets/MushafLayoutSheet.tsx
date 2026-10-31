import React, {useCallback, useRef, useState} from 'react'; // @ai
import {useWindowDimensions} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {
  SheetProps,
  ScrollView,
  type ActionSheetRef, // @ai
} from 'react-native-actions-sheet';
import ActionSheet from '@/components/sheets/AdaptiveActionSheet';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {useNativeSheetId} from '@/components/native/nativeSheetContext'; // @ai
import {createStyles, MushafLayoutPanel} from './MushafLayoutPanel'; // @ai

// @ai-start
/**
 * On a phone the sheet opens at its lower snap point, about half the
 * window, so the page stays visible; opening a card snaps it to the top.
 */
const PHONE_SNAP_POINTS = [60, 100];

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
  const grow = useCallback(() => sheetRef.current?.snapToIndex(1), []);

  return (
    <ActionSheet
      ref={sheetRef}
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      snapPoints={snaps ? PHONE_SNAP_POINTS : undefined}
      initialSnapIndex={snaps ? 0 : undefined}
      onClose={() => setResetKey(key => key + 1)}>
      <MushafLayoutPanel
        key={resetKey}
        context={props.payload?.context}
        ScrollComponent={ScrollView}
        onGrow={snaps ? grow : undefined}
        inLibrarySheet={!inNativeSheet}
      />
    </ActionSheet>
  );
};

// @ai-end
