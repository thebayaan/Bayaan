import {create} from 'zustand';
import TrackPlayer, {Track} from 'react-native-track-player';

interface QueueState {
  queue: Track[];
  addToQueue: (tracks: Track | Track[]) => Promise<void>;
  addNext: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  shuffleQueue: () => Promise<void>;
  getQueue: () => Promise<Track[]>;
  skipToTrack: (index: number) => Promise<Track>;
}

export const useQueueStore = create<QueueState>(set => ({
  queue: [],

  addToQueue: async (tracks: Track | Track[]) => {
    const tracksToAdd = Array.isArray(tracks) ? tracks : [tracks];
    await TrackPlayer.add(tracksToAdd);
    const updatedQueue = await TrackPlayer.getQueue();
    set({queue: updatedQueue});
  },

  addNext: async (track: Track) => {
    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    if (currentIndex !== undefined) {
      await TrackPlayer.add(track, currentIndex + 1);
    } else {
      await TrackPlayer.add(track);
    }
    const updatedQueue = await TrackPlayer.getQueue();
    set({queue: updatedQueue});
  },

  removeFromQueue: async (index: number) => {
    await TrackPlayer.remove(index);
    const updatedQueue = await TrackPlayer.getQueue();
    set({queue: updatedQueue});
  },

  clearQueue: async () => {
    await TrackPlayer.reset();
    set({queue: []});
  },

  shuffleQueue: async () => {
    const currentQueue = await TrackPlayer.getQueue();
    const currentTrack = await TrackPlayer.getActiveTrackIndex();

    let shuffledQueue = [...currentQueue];
    for (let i = shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQueue[i], shuffledQueue[j]] = [
        shuffledQueue[j],
        shuffledQueue[i],
      ];
    }

    if (currentTrack !== undefined) {
      const currentTrackItem = shuffledQueue.find(
        track => track.id === currentQueue[currentTrack].id,
      );
      if (currentTrackItem) {
        shuffledQueue = [
          currentTrackItem,
          ...shuffledQueue.filter(track => track.id !== currentTrackItem.id),
        ];
      }
    }

    await TrackPlayer.reset();
    await TrackPlayer.add(shuffledQueue);
    if (currentTrack !== null) {
      await TrackPlayer.skip(0);
    }
    set({queue: shuffledQueue});
  },

  getQueue: async () => {
    const queue = await TrackPlayer.getQueue();
    set({queue});
    return queue;
  },

  skipToTrack: async (index: number): Promise<Track> => {
    await TrackPlayer.skip(index);
    const currentTrack = await TrackPlayer.getTrack(index);
    if (!currentTrack) {
      throw new Error('Failed to skip to track: Track not found');
    }
    set(state => ({...state, currentTrackIndex: index}));
    return currentTrack;
  },
}));
