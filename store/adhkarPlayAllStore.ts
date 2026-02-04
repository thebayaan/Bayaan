/**
 * Adhkar Play All Store
 *
 * Manages queue and state for sequential "Play All" adhkar playback.
 * Works alongside adhkarAudioStore - this store manages the queue,
 * while adhkarAudioStore manages the actual player intent.
 */

import {create} from 'zustand';
import {Dhikr} from '@/types/adhkar';
import {useAdhkarAudioStore} from '@/store/adhkarAudioStore';

type SourceType = 'morning' | 'evening' | 'saved';

interface AdhkarPlayAllState {
  // Mode
  isPlayAllMode: boolean;

  // Queue
  queue: Dhikr[];
  currentIndex: number;

  // Source identification
  sourceType: SourceType | null;
  sourceId: string | null;

  // Playback intent
  isPlaying: boolean;
}

interface AdhkarPlayAllActions {
  // Start Play All with a list of adhkar
  startPlayAll: (
    adhkarList: Dhikr[],
    startIndex: number,
    sourceType: SourceType,
    sourceId: string,
  ) => void;

  // Stop Play All and reset
  stopPlayAll: () => void;

  // Navigation
  advanceToNext: () => boolean; // Returns false if at end
  goToPrevious: () => boolean; // Returns false if at start
  goToIndex: (index: number) => void;

  // Playback control
  play: () => void;
  pause: () => void;
  toggle: () => void;

  // Get current dhikr
  getCurrentDhikr: () => Dhikr | null;
}

export const useAdhkarPlayAllStore = create<
  AdhkarPlayAllState & AdhkarPlayAllActions
>((set, get) => ({
  // Initial state
  isPlayAllMode: false,
  queue: [],
  currentIndex: 0,
  sourceType: null,
  sourceId: null,
  isPlaying: false,

  startPlayAll: (adhkarList, startIndex, sourceType, sourceId) => {
    if (adhkarList.length === 0) return;

    // Stop single-dhikr playback
    useAdhkarAudioStore.getState().pause();

    set({
      isPlayAllMode: true,
      queue: adhkarList,
      currentIndex: Math.min(startIndex, adhkarList.length - 1),
      sourceType,
      sourceId,
      isPlaying: true,
    });
  },

  stopPlayAll: () => {
    set({
      isPlayAllMode: false,
      queue: [],
      currentIndex: 0,
      sourceType: null,
      sourceId: null,
      isPlaying: false,
    });
  },

  advanceToNext: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode) return false;

    if (currentIndex < queue.length - 1) {
      set({currentIndex: currentIndex + 1});
      return true;
    }
    // End of queue - stop Play All
    get().stopPlayAll();
    return false;
  },

  goToPrevious: () => {
    const {currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode) return false;

    if (currentIndex > 0) {
      set({currentIndex: currentIndex - 1});
      return true;
    }
    return false;
  },

  goToIndex: index => {
    const {queue, isPlayAllMode} = get();
    if (!isPlayAllMode) return;

    if (index >= 0 && index < queue.length) {
      set({currentIndex: index});
    }
  },

  play: () => {
    const {isPlayAllMode} = get();
    if (!isPlayAllMode) return;
    set({isPlaying: true});
  },

  pause: () => {
    set({isPlaying: false});
  },

  toggle: () => {
    const {isPlaying, isPlayAllMode} = get();
    if (!isPlayAllMode) return;

    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  getCurrentDhikr: () => {
    const {queue, currentIndex, isPlayAllMode} = get();
    if (!isPlayAllMode || queue.length === 0) return null;
    return queue[currentIndex] || null;
  },
}));
