// @ai-generated
import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View, LayoutChangeEvent} from 'react-native';
import Color from 'color';
import {SheetManager} from 'react-native-actions-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {SURAHS} from '@/data/surahData';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {useResponsive} from '@/hooks/useResponsive';
import {TabletPlayerReciterColumn} from '@/components/tablet/TabletPlayerReciterColumn';
import {TabletPlayerControlsColumn} from '@/components/tablet/TabletPlayerControlsColumn';
import PlayerContent from './PlayerContent';
import TabletPlayer from './TabletPlayer';

/**
 * The full player's contents and the handlers its controls open (speed, sleep
 * timer, options, follow along), independent of the container hosting it.
 * Rendered inside the gorhom PlayerSheet or the morphing PlayerSurface.
 */
export const PlayerBody = () => {
  const {theme} = useTheme();
  const {isTablet, orientation} = useResponsive();
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState<number | undefined>(
    undefined,
  );
  const [tabletShowQueue, setTabletShowQueue] = useState(false);
  const handleTabletQueueToggle = useCallback(
    () => setTabletShowQueue(v => !v),
    [],
  );
  const {navigateToReciterProfile} = useReciterNavigation();

  const {setSheetMode, setRate, updateSettings} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const sheetMode = usePlayerStore(s => s.sheetMode);
  const playbackRate = usePlayerStore(s => s.playback.rate);
  const settings = usePlayerStore(s => s.settings);

  // Effect to handle sleep timer remaining time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
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

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];

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

  const handleLeftPaneLayout = useCallback((e: LayoutChangeEvent) => {
    setLeftPaneWidth(e.nativeEvent.layout.width);
  }, []);

  // Landscape keeps the reciter-list split (only when there's a reciter).
  // Portrait always splits on iPad: mushaf on the left, player controls on
  // the right (replacing the reciter list in portrait).
  const isTabletFull = isTablet && sheetMode === 'full';
  const landscapeSplit =
    isTabletFull && orientation === 'landscape' && !!currentTrack?.reciterId;
  const portraitSplit = isTabletFull && orientation === 'portrait';
  const showTabletSplit = landscapeSplit || portraitSplit;

  const playerContentEl = isTablet ? (
    <TabletPlayer
      measuredParentWidth={showTabletSplit ? leftPaneWidth : undefined}
      bodyOnly={portraitSplit}
      showQueue={portraitSplit ? tabletShowQueue : undefined}
      onQueueToggle={portraitSplit ? handleTabletQueueToggle : undefined}
      onSpeedPress={handleShowSpeedSheet}
      onSleepTimerPress={handleShowSleepTimerSheet}
      onMushafLayoutPress={handleShowMushafLayoutSheet}
      onAmbientPress={handleShowAmbientSheet}
      onOptionsPress={handleShowOptionsSheet}
      onFollowAlongPress={handleFollowAlongPress}
    />
  ) : (
    <PlayerContent
      onSpeedPress={handleShowSpeedSheet}
      onSleepTimerPress={handleShowSleepTimerSheet}
      onMushafLayoutPress={handleShowMushafLayoutSheet}
      onAmbientPress={handleShowAmbientSheet}
      onOptionsPress={handleShowOptionsSheet}
      onFollowAlongPress={handleFollowAlongPress}
    />
  );

  return showTabletSplit ? (
    <View style={styles.tabletSplitRoot}>
      <View
        style={styles.tabletSplitPlayerPane}
        onLayout={handleLeftPaneLayout}>
        {playerContentEl}
      </View>
      <View
        style={[
          styles.tabletSplitDivider,
          {
            backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
          },
        ]}
      />
      <View style={styles.tabletSplitReciterPane}>
        {portraitSplit ? (
          <TabletPlayerControlsColumn
            showQueue={tabletShowQueue}
            onQueueToggle={handleTabletQueueToggle}
            onSpeedPress={handleShowSpeedSheet}
            onSleepTimerPress={handleShowSleepTimerSheet}
            onMushafLayoutPress={handleShowMushafLayoutSheet}
            onAmbientPress={handleShowAmbientSheet}
            onOptionsPress={handleShowOptionsSheet}
            onFollowAlongPress={handleFollowAlongPress}
          />
        ) : (
          <TabletPlayerReciterColumn
            reciterId={currentTrack!.reciterId!}
            initialRewayatId={currentTrack!.rewayatId}
          />
        )}
      </View>
    </View>
  ) : (
    playerContentEl
  );
};

const styles = StyleSheet.create({
  tabletSplitRoot: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%',
  },
  tabletSplitPlayerPane: {
    flex: 11,
    minWidth: 0,
  },
  tabletSplitDivider: {
    width: StyleSheet.hairlineWidth,
  },
  tabletSplitReciterPane: {
    flex: 9,
    minWidth: 0,
    maxWidth: 560,
  },
});
