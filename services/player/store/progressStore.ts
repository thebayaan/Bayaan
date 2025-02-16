import {create} from 'zustand';
import TrackPlayer, {Event} from 'react-native-track-player';
import {useEffect} from 'react';

interface ProgressState {
  position: number;
  duration: number;
  buffered: number;
  updateInterval: number;
  isSeeking: boolean;
  seekPosition: number | null;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;
  setUpdateInterval: (interval: number) => void;
  setIsSeeking: (isSeeking: boolean) => void;
  setSeekPosition: (position: number | null) => void;
}

export const useProgressStore = create<ProgressState>(set => ({
  position: 0,
  duration: 0,
  buffered: 0,
  updateInterval: 250,
  isSeeking: false,
  seekPosition: null,
  setPosition: (position: number) => set({position}),
  setDuration: (duration: number) => set({duration}),
  setBuffered: (buffered: number) => set({buffered}),
  setUpdateInterval: (updateInterval: number) => set({updateInterval}),
  setIsSeeking: (isSeeking: boolean) => set({isSeeking}),
  setSeekPosition: (seekPosition: number | null) => set({seekPosition}),
}));

// Hook to subscribe to progress updates
export function useProgress() {
  const {
    position,
    duration,
    buffered,
    updateInterval,
    isSeeking,
    seekPosition,
    setPosition,
    setDuration,
    setBuffered,
    setIsSeeking,
    setSeekPosition,
  } = useProgressStore();

  useEffect(() => {
    let progressSubscription: ReturnType<typeof setInterval>;
    let eventSubscription: ReturnType<typeof TrackPlayer.addEventListener>;
    let mounted = true;

    const startProgressUpdates = () => {
      progressSubscription = setInterval(async () => {
        try {
          if (!mounted || isSeeking) return;

          const progress = await TrackPlayer.getProgress();

          // Batch updates to reduce re-renders
          const updates: Partial<ProgressState> = {};

          // Only update if the difference is significant
          if (Math.abs(progress.position - (seekPosition ?? position)) > 0.5) {
            updates.position = progress.position;
          }

          if (progress.buffered !== buffered) {
            updates.buffered = progress.buffered;
          }

          if (Object.keys(updates).length > 0) {
            useProgressStore.setState(updates);
          }
        } catch (error) {
          console.error('Error updating progress:', error);
        }
      }, updateInterval);
    };

    const setupListeners = async () => {
      try {
        // Listen for duration updates
        eventSubscription = TrackPlayer.addEventListener(
          Event.PlaybackProgressUpdated,
          data => {
            if (!mounted || isSeeking) return;

            // Batch updates to reduce re-renders
            const updates: Partial<ProgressState> = {};

            if (data.duration > 0 && data.duration !== duration) {
              updates.duration = data.duration;
            }

            // Only update position if not seeking and difference is significant
            if (!seekPosition && Math.abs(data.position - position) > 0.5) {
              updates.position = data.position;
            }

            if (Object.keys(updates).length > 0) {
              useProgressStore.setState(updates);
            }
          },
        );

        // Start progress updates
        startProgressUpdates();
      } catch (error) {
        console.error('Error setting up progress listeners:', error);
      }
    };

    setupListeners();

    return () => {
      mounted = false;
      if (progressSubscription) clearInterval(progressSubscription);
      if (eventSubscription) eventSubscription.remove();
    };
  }, [
    updateInterval,
    isSeeking,
    position,
    duration,
    buffered,
    seekPosition,
    setPosition,
    setDuration,
    setBuffered,
  ]);

  return {
    position,
    duration,
    buffered,
    isSeeking,
    seekPosition,
    setIsSeeking,
    setSeekPosition,
  };
}
