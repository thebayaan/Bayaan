import {create} from 'zustand';
import {useEffect, useRef} from 'react';
import {usePlayerStore} from './playerStore';
import {useAppForeground} from '@/hooks/useAppForeground'; // @ai

interface ProgressState {
  position: number;
  duration: number;
  buffered: number;
  isSeeking: boolean;
  seekPosition: number | null;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setBuffered: (buffered: number) => void;
  setIsSeeking: (isSeeking: boolean) => void;
  setSeekPosition: (position: number | null) => void;
}

export const useProgressStore = create<ProgressState>(set => ({
  position: 0,
  duration: 0,
  buffered: 0,
  isSeeking: false,
  seekPosition: null,
  setPosition: (position: number) => set({position}),
  setDuration: (duration: number) => set({duration}),
  setBuffered: (buffered: number) => set({buffered}),
  setIsSeeking: (isSeeking: boolean) => set({isSeeking}),
  setSeekPosition: (seekPosition: number | null) => set({seekPosition}),
}));

// @ai-start
export interface ShownPlaybackTime {
  position: number;
  duration: number;
}

/**
 * The player's position and duration, for UI that shows them.
 *
 * In the foreground this follows `playerStore.playback`. In the background
 * it holds the values already shown, so a position tick renders nothing:
 * Android would queue each update for the first frame on return. On return
 * it shows the live values. `inactive` (the iOS Control Center) counts as
 * foreground, so UI that is still on screen keeps updating.
 *
 * A component that mounts in the background starts from the live values.
 */
export function useShownPlaybackTime(): ShownPlaybackTime {
  const foreground = useAppForeground();
  const shownRef = useRef<ShownPlaybackTime | null>(null);
  const position = usePlayerStore(state =>
    foreground || !shownRef.current
      ? state.playback.position
      : shownRef.current.position,
  );
  const duration = usePlayerStore(state =>
    foreground || !shownRef.current
      ? state.playback.duration
      : shownRef.current.duration,
  );
  useEffect(() => {
    shownRef.current = {position, duration};
  }, [position, duration]);
  return {position, duration};
}
// @ai-end

/**
 * Hook to subscribe to progress updates
 *
 * Uses playerStore as the source of truth.
 * The ExpoAudioProvider updates playerStore.playback.position/duration,
 * and this hook syncs that to progressStore for backward compatibility.
 */
export function useProgress() {
  const {
    position,
    duration,
    buffered,
    isSeeking,
    seekPosition,
    setPosition,
    setDuration,
    setBuffered,
    setIsSeeking,
    setSeekPosition,
  } = useProgressStore();

  // Use refs to access latest values without causing effect re-runs
  const isSeekingRef = useRef(isSeeking);
  const seekPositionRef = useRef(seekPosition);
  const positionRef = useRef(position);
  const durationRef = useRef(duration);

  // @ai-start
  // Held at the shown values in the background (see useShownPlaybackTime).
  const {position: playbackPosition, duration: playbackDuration} =
    useShownPlaybackTime();
  // @ai-end

  // Keep refs in sync
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  useEffect(() => {
    seekPositionRef.current = seekPosition;
  }, [seekPosition]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Sync position and duration from playerStore
  useEffect(() => {
    // Don't update if seeking
    if (isSeekingRef.current) return;

    // Update duration if changed significantly
    if (
      playbackDuration > 0 &&
      Math.abs(playbackDuration - durationRef.current) > 0.5
    ) {
      setDuration(playbackDuration);
    }

    // Update position if not seeking and changed significantly
    if (
      !seekPositionRef.current &&
      Math.abs(playbackPosition - positionRef.current) > 0.5
    ) {
      setPosition(playbackPosition);
    }
  }, [playbackPosition, playbackDuration, setPosition, setDuration]); // @ai

  return {
    position,
    duration,
    buffered,
    isSeeking,
    seekPosition,
    setPosition,
    setIsSeeking,
    setSeekPosition,
  };
}
