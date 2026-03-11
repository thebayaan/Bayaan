import React, {useCallback, useMemo, useRef, useEffect, useState} from 'react';
import {StyleSheet, StatusBar, View, Platform, BackHandler} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import PlayerContent from './PlayerContent';
import Color from 'color';
import {SURAHS} from '@/data/surahData';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {SheetManager} from 'react-native-actions-sheet';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {
  registerPlayerSheetRef,
  unregisterPlayerSheetRef,
} from '@/services/player/sheetRef';

export const PlayerSheet = () => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const {navigateToReciterProfile} = useReciterNavigation();

  const {setSheetMode, setRate, updateSettings, setImmersive} =
    usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const loading = usePlayerStore(s => s.loading);
  const sheetMode = usePlayerStore(s => s.sheetMode);
  const isImmersive = usePlayerStore(s => s.isImmersive);
  const playbackRate = usePlayerStore(s => s.playback.rate);
  const settings = usePlayerStore(s => s.settings);

  // Register ref so MiniPlayer/FloatingPlayer can call expand() directly
  useEffect(() => {
    registerPlayerSheetRef(bottomSheetRef);
    return () => unregisterPlayerSheetRef();
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (sheetMode === 'full') {
        if (isImmersive) {
          setImmersive(false);
          return true;
        }
        setSheetMode('hidden');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [sheetMode, isImmersive, setSheetMode, setImmersive]);

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
      setImmersive(false);
      sheet.close();
    } else if (sheetMode === 'full') {
      sheet.expand();
    }
  }, [sheetMode, setImmersive]);

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
    },
    [setRate],
  );

  const handleSleepTimerChange = useCallback(
    (minutes: number) => {
      updateSettings({sleepTimer: minutes});
    },
    [updateSettings],
  );

  const handleTurnOffTimer = useCallback(() => {
    updateSettings({sleepTimer: 0});
  }, [updateSettings]);

  const handleGoToReciter = useCallback(() => {
    if (!currentTrack?.reciterId) return;
    setSheetMode('hidden');
    // Small delay to ensure sheet is closing before navigation
    setTimeout(() => {
      navigateToReciterProfile(currentTrack.reciterId);
    }, 100);
  }, [currentTrack, setSheetMode, navigateToReciterProfile]);

  // Handlers for showing sheets via SheetManager
  const handleShowSpeedSheet = useCallback(() => {
    SheetManager.show('playback-speed', {
      payload: {
        currentSpeed: playbackRate,
        onSpeedChange: handleSpeedChange,
      },
    });
  }, [playbackRate, handleSpeedChange]);

  const handleShowSleepTimerSheet = useCallback(() => {
    SheetManager.show('sleep-timer', {
      payload: {
        sleepTimer: remainingTime || 0,
        remainingTime,
        onTimerChange: handleSleepTimerChange,
        onTurnOffTimer: handleTurnOffTimer,
      },
    });
  }, [remainingTime, handleSleepTimerChange, handleTurnOffTimer]);

  const handleShowMushafLayoutSheet = useCallback(() => {
    SheetManager.show('mushaf-layout', {payload: {context: 'player'}});
  }, []);

  const handleShowAmbientSheet = useCallback(() => {
    SheetManager.show('ambient-sounds');
  }, []);

  const followAlongAvailable = useRewayatFollowAlong(currentTrack?.rewayatId);

  const handleFollowAlongPress = useCallback(() => {
    if (!followAlongAvailable) {
      SheetManager.show('follow-along');
      return;
    }

    const state = useTimestampStore.getState();

    // If follow along is enabled but user scrolled away (not locked), re-lock
    if (state.followAlongEnabled && !state.isLocked) {
      state.setIsLocked(true);
      return;
    }

    // Otherwise toggle follow along on/off
    state.toggleFollowAlong();
    // When enabling, also lock
    if (!state.followAlongEnabled) {
      state.setIsLocked(true);
    }
  }, [followAlongAvailable]);

  const handleShowOptionsSheet = useCallback(() => {
    if (!currentTrack) return;

    const surahNumber = currentTrack.surahId
      ? parseInt(currentTrack.surahId, 10)
      : undefined;
    const currentSurahData = surahNumber
      ? SURAHS.find(s => s.id === surahNumber)
      : undefined;

    // Upload tracks — always show options
    if (currentTrack.isUserUpload) {
      SheetManager.show('player-options', {
        payload: {
          surah: currentSurahData,
          reciterId: currentTrack.reciterId || undefined,
          rewayatId: currentTrack.rewayatId,
          onGoToReciter: currentTrack.reciterId ? handleGoToReciter : undefined,
          isUserUpload: true,
          userRecitationId: currentTrack.userRecitationId,
        },
      });
      return;
    }

    // System tracks — existing behavior
    if (currentSurahData && currentTrack.reciterId) {
      SheetManager.show('player-options', {
        payload: {
          surah: currentSurahData,
          reciterId: currentTrack.reciterId,
          rewayatId: currentTrack.rewayatId,
          onGoToReciter: handleGoToReciter,
        },
      });
    }
  }, [currentTrack, handleGoToReciter]);

  const renderHandleComponent = useCallback(
    (_props: BottomSheetHandleProps) => <View />,
    [],
  );

  // Only render modals once settings are loaded to prevent hydration issues
  if (!shouldShow) {
    return null;
  }

  const textColor = Color(theme.colors.text);
  const isLightText = textColor.isLight();

  return (
    <>
      {sheetMode === 'full' && (
        <StatusBar
          barStyle={isLightText ? 'light-content' : 'dark-content'}
          hidden={isImmersive}
          animated
        />
      )}
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
        style={styles.sheet}
        backgroundStyle={[
          styles.background,
          {backgroundColor: theme.colors.background},
        ]}>
        <PlayerContent
          onSpeedPress={handleShowSpeedSheet}
          onSleepTimerPress={handleShowSleepTimerSheet}
          onMushafLayoutPress={handleShowMushafLayoutSheet}
          onAmbientPress={handleShowAmbientSheet}
          onOptionsPress={handleShowOptionsSheet}
          onFollowAlongPress={handleFollowAlongPress}
        />
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  sheet: {
    zIndex: 2000,
    elevation: 20,
  },
  background: {
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
  },
});
