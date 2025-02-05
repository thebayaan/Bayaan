import React, {useCallback, useMemo, useRef, useEffect} from 'react';
import BottomSheet, {BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {usePlayerStore} from '@/store/playerStore';
import {PlayerContent} from './PlayerContent';
import {useTheme} from '@/hooks/useTheme';
import {usePlayerBackground} from '@/hooks/usePlayerBackground';

export const PlayerBottomSheet = () => {
  const {theme, isDarkMode} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isVisible = usePlayerStore(state => state.isPlayerSheetVisible);
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const setVisible = usePlayerStore(state => state.setPlayerSheetVisible);
  const {gradientColors} = usePlayerBackground(theme, isDarkMode);

  // Only one snap point at full screen height
  const snapPoints = useMemo(() => ['100%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      setVisible(index === 0);
    },
    [setVisible],
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  useEffect(() => {
    // Ensure we start with the sheet closed on mount
    bottomSheetRef.current?.close();
  }, []);

  useEffect(() => {
    if (isVisible && currentTrack) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, currentTrack]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      index={-1}
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
