// @ai-generated
import React, {useCallback, useEffect, useState} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {SURAHS} from '@/data/surahData';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {useResponsive} from '@/hooks/useResponsive';
import {PlayerKeyCommands} from '@/components/keyboard/PlayerKeyCommands';
import {keyCommandsSupported} from '@/services/keyboard/keyCommands';
import PlayerContent from './PlayerContent';
import {TabletPlayerLayout} from './tablet/TabletPlayerLayout';

/**
 * The full player's contents and the handlers its controls open (speed, sleep
 * timer, options, follow along), independent of the container hosting it.
 * Rendered inside the morphing PlayerSurface.
 */
export const PlayerBody = () => {
  const {isTablet} = useResponsive();
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const {navigateToReciterProfile} = useReciterNavigation();

  const {setSheetMode, setRate, updateSettings} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
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

  const handlers = {
    onSpeedPress: handleShowSpeedSheet,
    onSleepTimerPress: handleShowSleepTimerSheet,
    onMushafLayoutPress: handleShowMushafLayoutSheet,
    onAmbientPress: handleShowAmbientSheet,
    onOptionsPress: handleShowOptionsSheet,
    onFollowAlongPress: handleFollowAlongPress,
  };

  // iPad picks its layout from the window width (TabletPlayerLayout).
  // Not keyed on sheetMode: the layout would switch while the surface is
  // still shrinking on close. Closed, the surface is off-screen anyway.
  const body = isTablet ? (
    <TabletPlayerLayout {...handlers} />
  ) : (
    <PlayerContent {...handlers} />
  );

  return (
    <>
      {keyCommandsSupported() && (
        <PlayerKeyCommands onFollowAlongPress={handleFollowAlongPress} />
      )}
      {body}
    </>
  );
};
