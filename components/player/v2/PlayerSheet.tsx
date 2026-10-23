import React, {useCallback, useMemo, useRef, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {
  registerPlayerSheetRef,
  unregisterPlayerSheetController,
} from '@/services/player/sheetRef';
import {PlayerBody} from './PlayerBody';
import {GorhomPlayerDismissProvider} from './GorhomPlayerDismissProvider';

/** The full player hosted in a gorhom BottomSheet (slide-up transition). */
export const PlayerSheet = () => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {setSheetMode, setImmersive} = usePlayerActions();
  const sheetMode = usePlayerStore(s => s.sheetMode);

  // Register ref so MiniPlayer/FloatingPlayer can call expand() directly
  useEffect(() => {
    const controller = registerPlayerSheetRef(bottomSheetRef);
    return () => unregisterPlayerSheetController(controller);
  }, []);

  // Effect to handle sheet mode changes
  useEffect(() => {
    if (!bottomSheetRef.current) return;

    const sheet = bottomSheetRef.current;
    if (sheetMode === 'hidden') {
      setImmersive(false);
      sheet.close();
    } else if (sheetMode === 'full') {
      sheet.expand();
    }
  }, [sheetMode, setImmersive]);

  const snapPoints = useMemo(() => ['100%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      const newMode = index === 0 ? 'full' : 'hidden';
      if (sheetMode !== newMode) {
        setSheetMode(newMode);
      }
    },
    [setSheetMode, sheetMode],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => {
      // Slow-Android play-time freeze fix: gorhom's BottomSheetBackdrop mounts
      // pointerEvents:'auto' (full-screen absoluteFillObject, opacity-0 but still
      // hit-testable, wrapped in a Tap GestureDetector) and only flips to 'none'
      // via a useAnimatedReaction -> runOnJS -> setState chain gated on its
      // internal animatedIndex settling to disappearsOnIndex (-1). On a slow CPU
      // the *closed* sheet's container-height layout race delays that settle, so
      // the backdrop keeps eating EVERY touch while the sheet is logically hidden
      // -> the whole app is unresponsive though audio keeps playing and only the
      // hardware BACK key works. Don't render the backdrop at all unless the sheet
      // is the full player; keyed off the LOGICAL sheetMode (set synchronously
      // before expand()), so it is immune to gorhom's racing animatedIndex.
      if (sheetMode !== 'full') {
        return null;
      }
      return (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      );
    },
    [sheetMode],
  );

  const renderHandleComponent = useCallback(
    (_props: BottomSheetHandleProps) => <View />,
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      index={-1}
      animateOnMount={false}
      handleComponent={renderHandleComponent}
      enableContentPanningGesture
      enableOverDrag={false}
      style={[styles.sheet, sheetMode !== 'full' && styles.sheetUntouchable]}
      backgroundStyle={[styles.background, {backgroundColor: 'transparent'}]}>
      <GorhomPlayerDismissProvider>
        <PlayerBody />
      </GorhomPlayerDismissProvider>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    zIndex: 2000,
    elevation: 20,
  },
  // Slow-Android play-time freeze fix (sibling guard of the backdrop gate above).
  // gorhom applies this `style` to BottomSheetBody (an Animated.View), so the
  // elevation:20 lives there; on a slow CPU a mis-positioned *closed* sheet's
  // elevated Body can also capture touches (Android elevation drives touch order).
  // pointerEvents:'none' removes it from hit-testing whenever the sheet is not the
  // full player — keyed off logical sheetMode, not gorhom's racing animatedIndex.
  sheetUntouchable: {
    pointerEvents: 'none',
  },
  background: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
});
