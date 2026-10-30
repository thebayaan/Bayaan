// @ai-generated
import React, {useCallback, useMemo} from 'react';
import {SheetManager} from 'react-native-actions-sheet';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {SURAHS} from '@/data/surahData';
import {useReciterNavigation} from '@/hooks/useReciterNavigation';
import {useTimestampStore} from '@/store/timestampStore';
import {useRewayatFollowAlong} from '@/hooks/useFollowAlong';
import {useResponsive} from '@/hooks/useResponsive';
import {useSleepTimerRemaining} from '@/hooks/useSleepTimerRemaining';
import {PlayerKeyCommands} from '@/components/keyboard/PlayerKeyCommands';
import {keyCommandsSupported} from '@/services/keyboard/keyCommands';
import PlayerContent from './PlayerContent';
import {TabletPlayerLayout} from './tablet/TabletPlayerLayout';
// @ai-start
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import {
  PlayerOptionsMenu,
  type PlayerOptionsPayload,
} from '@/components/sheets/options/playerOptions';
import {showSheet} from '@/components/sheets/sheetControl'; // @ai
// @ai-end

/**
 * The full player's contents and the handlers its controls open (speed, sleep
 * timer, options, follow along), independent of the container hosting it.
 * Rendered inside the morphing PlayerSurface.
 */
export const PlayerBody = () => {
  const {isTablet} = useResponsive();
  const remainingTime = useSleepTimerRemaining();
  const {navigateToReciterProfile} = useReciterNavigation();

  const {setSheetMode, setRate, updateSettings} = usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const playbackRate = usePlayerStore(s => s.playback.rate);

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
    showSheet('mushaf-layout', {payload: {context: 'player'}});
  }, []);

  const handleShowAmbientSheet = useCallback(() => {
    showSheet('ambient-sounds');
  }, []);

  const followAlongAvailable = useRewayatFollowAlong(currentTrack?.rewayatId);

  const handleFollowAlongPress = useCallback(() => {
    if (!followAlongAvailable) {
      showSheet('follow-along');
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

  // @ai-start
  // The options for the current track: the sheet on phones, and a native
  // menu on the iPad player's ••• buttons.
  const optionsPayload = useMemo<PlayerOptionsPayload | null>(() => {
    if (!currentTrack) return null;
    const surahNumber = currentTrack.surahId
      ? parseInt(currentTrack.surahId, 10)
      : undefined;
    const currentSurahData = surahNumber
      ? SURAHS.find(s => s.id === surahNumber)
      : undefined;

    // Upload tracks always have options.
    if (currentTrack.isUserUpload) {
      return {
        surah: currentSurahData,
        reciterId: currentTrack.reciterId || undefined,
        rewayatId: currentTrack.rewayatId,
        onGoToReciter: currentTrack.reciterId ? handleGoToReciter : undefined,
        isUserUpload: true,
        userRecitationId: currentTrack.userRecitationId,
      };
    }
    if (currentSurahData && currentTrack.reciterId) {
      return {
        surah: currentSurahData,
        reciterId: currentTrack.reciterId,
        rewayatId: currentTrack.rewayatId,
        onGoToReciter: handleGoToReciter,
      };
    }
    return null;
  }, [currentTrack, handleGoToReciter]);

  const handleShowOptionsSheet = useCallback(() => {
    if (optionsPayload) {
      SheetManager.show('player-options', {payload: optionsPayload});
    }
  }, [optionsPayload]);

  const optionsMenu =
    isTablet && nativeMenusAvailable && optionsPayload ? (
      <PlayerOptionsMenu payload={optionsPayload} layout="overlay" />
    ) : null;
  // @ai-end

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
    <TabletPlayerLayout {...handlers} optionsMenu={optionsMenu} />
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
