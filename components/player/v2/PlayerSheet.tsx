import React, {useCallback, useMemo, useRef, useEffect, useState} from 'react';
import {StyleSheet, StatusBar, View, Platform, BackHandler} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useTheme} from '@/hooks/useTheme';
import PlayerContent from './PlayerContent';
import Color from 'color';
import {PlaybackSpeedModal} from './Modals/PlaybackSpeedModal';
import {SleepTimerModal} from './Modals/SleepTimerModal';
import {ExtendedSummaryModal} from './SurahSummary/ExtendedSummaryModal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MushafLayoutModal} from './Modals/MushafLayoutModal';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

// Custom handle component for the bottom sheet
const CustomHandle = (_props: BottomSheetHandleProps) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.handleContainer, {paddingTop: insets.top + 12}]}>
      <View
        style={[
          styles.handle,
          {backgroundColor: Color(theme.colors.text).alpha(0.2).toString()},
        ]}
      />
    </View>
  );
};

export const PlayerSheet = () => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const speedBottomSheetRef = useRef<BottomSheet>(null);
  const sleepBottomSheetRef = useRef<BottomSheet>(null);
  const summaryBottomSheetRef = useRef<BottomSheet>(null);
  const mushafLayoutSheetRef = useRef<BottomSheet>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  const {
    queue,
    loading,
    sheetMode,
    setSheetMode,
    playback,
    setRate,
    settings,
    updateSettings,
  } = useUnifiedPlayer();

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (sheetMode === 'full') {
        setSheetMode('hidden');
        return true; // Prevent default behavior
      }
      return false; // Let default behavior happen
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [sheetMode, setSheetMode]);

  // Effect to handle sleep timer remaining time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (settings.sleepTimerEnd) {
      interval = setInterval(() => {
        // Calculate remaining time based on the end timestamp
        const now = Date.now();
        const timeRemaining = settings.sleepTimerEnd
          ? settings.sleepTimerEnd - now
          : 0;

        if (timeRemaining > 0) {
          // For very short timers (less than 1 minute), display seconds
          if (timeRemaining < 60 * 1000) {
            const remainingSeconds = Math.ceil(timeRemaining / 1000);
            setRemainingTime(remainingSeconds / 60); // Convert to fractional minutes
          } else {
            const remainingMinutes = Math.ceil(timeRemaining / (60 * 1000));
            setRemainingTime(remainingMinutes);
          }
        } else {
          setRemainingTime(null);
        }
      }, 500); // Update more frequently for short timers
    } else {
      setRemainingTime(null);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [settings.sleepTimerEnd]);

  // Effect to handle sheet mode changes
  useEffect(() => {
    if (!bottomSheetRef.current) return;

    const sheet = bottomSheetRef.current;
    if (sheetMode === 'hidden') {
      sheet.close();
    } else if (sheetMode === 'full') {
      sheet.expand();
    }
  }, [sheetMode]);

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const shouldShow = !loading?.stateRestoring && !!currentTrack;

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

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setRate(speed);
      speedBottomSheetRef.current?.close();
    },
    [setRate],
  );

  const handleSleepTimerChange = useCallback(
    (minutes: number) => {
      updateSettings({sleepTimer: minutes});
      sleepBottomSheetRef.current?.close();
    },
    [updateSettings],
  );

  const handleTurnOffTimer = useCallback(() => {
    updateSettings({sleepTimer: 0});
    sleepBottomSheetRef.current?.close();
  }, [updateSettings]);

  // Only render modals once settings are loaded to prevent hydration issues
  if (!shouldShow) {
    return null;
  }

  const currentIndex = sheetMode === 'full' ? 0 : -1;
  const textColor = Color(theme.colors.text);
  const isLightText = textColor.isLight();

  // Get current surah info for the summary modal
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const currentSurahInfo = surahNumber ? surahInfo[surahNumber] : undefined;

  return (
    <>
      {sheetMode === 'full' && (
        <StatusBar barStyle={isLightText ? 'light-content' : 'dark-content'} />
      )}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        index={currentIndex}
        animateOnMount={false}
        handleComponent={CustomHandle}
        enableContentPanningGesture={Platform.OS === 'ios'}
        style={styles.sheet}
        backgroundStyle={[
          styles.background,
          {backgroundColor: theme.colors.background},
        ]}>
        <PlayerContent
          speedBottomSheetRef={speedBottomSheetRef}
          sleepBottomSheetRef={sleepBottomSheetRef}
          summaryBottomSheetRef={summaryBottomSheetRef}
          mushafLayoutSheetRef={mushafLayoutSheetRef}
        />
      </BottomSheet>

      <PlaybackSpeedModal
        bottomSheetRef={speedBottomSheetRef}
        onSpeedChange={handleSpeedChange}
        currentSpeed={playback.rate}
      />

      <SleepTimerModal
        bottomSheetRef={sleepBottomSheetRef}
        onTimerChange={handleSleepTimerChange}
        onTurnOffTimer={handleTurnOffTimer}
        sleepTimer={remainingTime || 0}
        remainingTime={remainingTime}
      />

      {currentSurahInfo && (
        <ExtendedSummaryModal
          bottomSheetRef={summaryBottomSheetRef}
          surahInfo={currentSurahInfo}
        />
      )}

      <MushafLayoutModal bottomSheetRef={mushafLayoutSheetRef} />
    </>
  );
};

const styles = StyleSheet.create({
  sheet: {
    zIndex: 2000,
  },
  background: {
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
  },
  handleContainer: {
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});
