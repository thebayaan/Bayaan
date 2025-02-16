import React, {useCallback, useMemo, useRef, useEffect} from 'react';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {PlayerContent} from './PlayerContent';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerColors} from '@/hooks/usePlayerColors';
import type {BottomSheetBackdropProps} from '@gorhom/bottom-sheet';

export const PlayerBottomSheet = () => {
  console.log('[PlayerBottomSheet] Rendering');

  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const {queue, loading, sheetMode, setSheetMode} = useUnifiedPlayer();
  const colors = usePlayerColors();

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const shouldShow = !loading?.stateRestoring && !!currentTrack;

  console.log('[PlayerBottomSheet] State:', {
    sheetMode,
    shouldShow,
    hasCurrentTrack: !!currentTrack,
    isLoading: loading?.stateRestoring,
  });

  const snapPoints = useMemo(() => ['100%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      console.log('[PlayerBottomSheet] Sheet index changed:', {
        index,
        currentMode: sheetMode,
      });

      // Only update if the mode would actually change
      const newMode = index === 0 ? 'full' : 'hidden';
      if (sheetMode !== newMode) {
        console.log('[PlayerBottomSheet] Updating sheet mode:', newMode);
        setSheetMode(newMode);
      }
    },
    [setSheetMode, sheetMode],
  );

  // Debug effect to track sheetMode changes
  useEffect(() => {
    console.log('[PlayerBottomSheet] sheetMode changed:', sheetMode);
  }, [sheetMode]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const gradientColors = colors?.primary
    ? [colors.primary, colors.secondary]
    : [theme.colors.card, theme.colors.card];

  if (!shouldShow) {
    console.log('[PlayerBottomSheet] Not showing sheet');
    return null;
  }

  const currentIndex = sheetMode === 'full' ? 0 : -1;
  console.log('[PlayerBottomSheet] Rendering sheet with index:', currentIndex);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      index={currentIndex}
      animateOnMount={false}
      handleIndicatorStyle={{
        display: 'none',
      }}
      backgroundStyle={{
        backgroundColor: gradientColors[0],
        borderTopLeftRadius: 45,
        borderTopRightRadius: 45,
      }}
      handleStyle={{
        backgroundColor: gradientColors[0],
        borderTopLeftRadius: 45,
        borderTopRightRadius: 45,
      }}>
      <PlayerContent />
    </BottomSheet>
  );
};
