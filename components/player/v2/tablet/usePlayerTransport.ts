// @ai-generated
import {useCallback, useEffect, useState} from 'react';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useProgress} from '@/services/player/store/progressStore';

export const SEEK_INTERVAL = 15;

/**
 * Transport state and handlers shared by the iPad player's Now Playing
 * column and transport card: optimistic play/pause, previous/next, ±15s,
 * the scrubber's drag state and the repeat cycle.
 */
export function usePlayerTransport() {
  const {play, pause, skipToNext, skipToPrevious, seekTo, updateSettings} =
    usePlayerActions();
  const queue = usePlayerStore(s => s.queue);
  const playbackState = usePlayerStore(s => s.playback.state);
  const playbackRate = usePlayerStore(s => s.playback.rate);
  const repeatMode = usePlayerStore(s => s.settings.repeatMode);
  const sleepTimerEnd = usePlayerStore(s => s.settings.sleepTimerEnd);
  const trackLoading = usePlayerStore(s => s.loading.trackLoading);
  const progress = useProgress();

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const isLastTrack = queue.currentIndex === queue.tracks.length - 1;

  const [isPlaying, setIsPlaying] = useState(() => playbackState === 'playing');
  useEffect(() => {
    setIsPlaying(playbackState === 'playing');
  }, [playbackState]);

  const togglePlay = useCallback(async () => {
    if (trackLoading) return;
    const next = !isPlaying;
    setIsPlaying(next);
    try {
      if (next) await play();
      else await pause();
    } catch (e) {
      setIsPlaying(!next);
      console.error('usePlayerTransport: toggle failed', e);
    }
  }, [trackLoading, isPlaying, play, pause]);

  const previous = useCallback(async () => {
    if (trackLoading) return;
    await skipToPrevious();
  }, [trackLoading, skipToPrevious]);
  const next = useCallback(async () => {
    if (trackLoading || isLastTrack) return;
    await skipToNext();
  }, [trackLoading, isLastTrack, skipToNext]);
  const seekBack = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(Math.max(0, progress.position - SEEK_INTERVAL));
  }, [trackLoading, progress.position, seekTo]);
  const seekForward = useCallback(async () => {
    if (trackLoading) return;
    await seekTo(progress.position + SEEK_INTERVAL);
  }, [trackLoading, progress.position, seekTo]);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const position = isSeeking
    ? seekValue
    : (progress.seekPosition ?? progress.position);
  const onSlidingStart = useCallback(() => {
    setIsSeeking(true);
    setSeekValue(progress.seekPosition ?? progress.position);
  }, [progress.seekPosition, progress.position]);
  const onValueChange = useCallback((v: number) => setSeekValue(v), []);
  const onSlidingComplete = useCallback(
    async (v: number) => {
      try {
        progress.setPosition(v);
        await seekTo(v);
      } catch (e) {
        console.error('usePlayerTransport: seek failed', e);
      } finally {
        setIsSeeking(false);
      }
    },
    [progress, seekTo],
  );

  const cycleRepeat = useCallback(() => {
    const nextMode = ({none: 'queue', queue: 'track', track: 'none'} as const)[
      repeatMode
    ];
    updateSettings({repeatMode: nextMode});
  }, [repeatMode, updateSettings]);

  return {
    currentTrack,
    trackLoading,
    isLastTrack,
    isPlaying,
    togglePlay,
    previous,
    next,
    seekBack,
    seekForward,
    scrubber: {
      position,
      duration: progress.duration,
      isSeeking,
      onSlidingStart,
      onValueChange,
      onSlidingComplete,
    },
    playbackRate,
    repeatMode,
    cycleRepeat,
    isTimerActive: sleepTimerEnd !== null && sleepTimerEnd > Date.now(),
  };
}

export type PlayerTransport = ReturnType<typeof usePlayerTransport>;
