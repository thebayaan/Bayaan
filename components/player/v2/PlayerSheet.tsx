import React, {useCallback, useMemo, useRef, useEffect, useState} from 'react';
import {StyleSheet, StatusBar} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useTheme} from '@/hooks/useTheme';
import PlayerContent from './PlayerContent';
import Color from 'color';
import {PlaybackSpeedModal} from './Modals/PlaybackSpeedModal';
import {SleepTimerModal} from './Modals/SleepTimerModal';
import {ExtendedSummaryModal} from './SurahSummary/ExtendedSummaryModal';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

export const PlayerSheet = () => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const speedBottomSheetRef = useRef<BottomSheet>(null);
  const sleepBottomSheetRef = useRef<BottomSheet>(null);
  const queueBottomSheetRef = useRef<BottomSheet>(null);
  const summaryBottomSheetRef = useRef<BottomSheet>(null);
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

  // Effect to handle sleep timer remaining time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (typeof settings.sleepTimer === 'object') {
      interval = setInterval(() => {
        // Access the internal timer value safely
        const timer = settings.sleepTimer as unknown as {
          _idleTimeout?: number;
        };
        const remaining = timer._idleTimeout
          ? Math.ceil(timer._idleTimeout / 1000 / 60)
          : 0;
        setRemainingTime(remaining);
      }, 1000);
    } else {
      setRemainingTime(null);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [settings.sleepTimer]);

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
        handleComponent={null}
        style={styles.sheet}
        backgroundStyle={[
          styles.background,
          {backgroundColor: theme.colors.background},
        ]}>
        <PlayerContent
          speedBottomSheetRef={speedBottomSheetRef}
          sleepBottomSheetRef={sleepBottomSheetRef}
          queueBottomSheetRef={queueBottomSheetRef}
          summaryBottomSheetRef={summaryBottomSheetRef}
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
        sleepTimer={settings.sleepTimer}
        remainingTime={remainingTime}
      />

      {currentSurahInfo && (
        <ExtendedSummaryModal
          bottomSheetRef={summaryBottomSheetRef}
          surahInfo={currentSurahInfo}
        />
      )}
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
});
