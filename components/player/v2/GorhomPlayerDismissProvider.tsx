// @ai-generated
import React, {useCallback, useMemo} from 'react';
import type {ScrollViewProps} from 'react-native';
import {
  useBottomSheetGestureHandlers,
  useBottomSheetInternal,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import {Gesture} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';
import {
  PlayerDismissProvider,
  type PlayerDismissApi,
} from './PlayerDismissContext';

/**
 * Supplies the gorhom sheet's pan handlers and scrollable to the player
 * content. Must render inside the BottomSheet: gorhom's hooks read its
 * internal context.
 */
export const GorhomPlayerDismissProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {handlePanGestureHandler} = useBottomSheetGestureHandlers();
  const {animatedPosition, animatedLayoutState} = useBottomSheetInternal();
  const createScrollable = useBottomSheetScrollableCreator<ScrollViewProps>();

  // Safety sync: when a gesture drags the sheet exactly to the closed
  // position, gorhom's animateToPosition early-returns (no animation needed)
  // so onChange never fires and sheetMode stays stale. This callback ensures
  // the store is synced after every gesture.
  const {setSheetMode} = usePlayerActions();
  const syncSheetModeIfClosed = useCallback(() => {
    const {sheetMode} = usePlayerStore.getState();
    if (sheetMode !== 'hidden') {
      setSheetMode('hidden');
    }
  }, [setSheetMode]);

  // Gorhom locks vertical scrollables with scrollTo(ref, 0, y). Fabric
  // converts that x coordinate in RTL, which can trigger another scroll event
  // and lock recursively while the player is closed. Keep only the native
  // viewport LTR; its content still inherits the selected language's
  // direction.
  const renderScrollComponent = useCallback(
    (props: ScrollViewProps, ref?: never) =>
      createScrollable(
        {
          ...props,
          style: [props.style, forceLTR],
          contentContainerStyle: [
            props.contentContainerStyle,
            appLayoutDirection,
          ],
        },
        ref,
      ),
    [createScrollable],
  );

  const createDismissGesture = useCallback(
    () =>
      Gesture.Pan()
        .onStart(handlePanGestureHandler.handleOnStart)
        .onChange(handlePanGestureHandler.handleOnChange)
        .onEnd(handlePanGestureHandler.handleOnEnd)
        .onFinalize(event => {
          'worklet';
          handlePanGestureHandler.handleOnFinalize(event);

          // If position is at/near closed detent, force-sync sheetMode.
          // This catches the edge case where handleOnEnd returns early
          // without starting an animation (destination === current position).
          const containerHeight = animatedLayoutState.get().containerHeight;
          if (
            containerHeight > 0 &&
            animatedPosition.value >= containerHeight - 1
          ) {
            runOnJS(syncSheetModeIfClosed)();
          }
        })
        .shouldCancelWhenOutside(false)
        .runOnJS(false),
    [
      handlePanGestureHandler,
      animatedPosition,
      animatedLayoutState,
      syncSheetModeIfClosed,
    ],
  );

  const api = useMemo<PlayerDismissApi>(
    () => ({createDismissGesture, renderScrollComponent}),
    [createDismissGesture, renderScrollComponent],
  );

  return <PlayerDismissProvider value={api}>{children}</PlayerDismissProvider>;
};
