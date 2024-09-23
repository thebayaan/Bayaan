import {create} from 'zustand';
import TrackPlayer, {
  Event,
  State,
  Track,
  RepeatMode,
} from 'react-native-track-player';

interface PlayerState {
  activeTrack: Track | null;
  isPlaying: boolean;
  sleepTimer: NodeJS.Timeout | null;
  sleepTimerEnd: number | null;
  playbackSpeed: number;
  repeatMode: 'off' | 'all' | 'once';
  setActiveTrack: (track: Track) => Promise<void>;
  togglePlayback: () => Promise<void>;
  loadAndPlayTrack: (track: Track) => Promise<void>;
  setSleepTimer: (minutes: number | 'END_OF_SURAH') => void;
  clearSleepTimer: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleRepeatMode: () => void;
  isEndOfSurahTimer: boolean;
  handleTrackEnd: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeTrack: null,
  isPlaying: false,
  sleepTimer: null,
  sleepTimerEnd: null,
  playbackSpeed: 1,
  repeatMode: 'off',
  isEndOfSurahTimer: false,
  setActiveTrack: async track => {
    set({activeTrack: track});
  },

  togglePlayback: async () => {
    const {isPlaying} = get();
    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      set({isPlaying: !isPlaying});
    } catch (error) {
      console.error('Error in togglePlayback:', error);
    }
  },

  loadAndPlayTrack: async track => {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add([track]);

      // Wait for the track to be loaded
      await new Promise<void>(resolve => {
        const listener = TrackPlayer.addEventListener(
          Event.PlaybackState,
          async ({state}) => {
            if (state === State.Ready) {
              listener.remove();
              resolve();
            }
          },
        );
      });

      await TrackPlayer.play();
      set({activeTrack: track, isPlaying: true});
    } catch (error) {
      console.error('Error in loadAndPlayTrack:', error);
    }
  },

  setSleepTimer: minutes => {
    const {sleepTimer} = get();
    if (sleepTimer) {
      clearTimeout(sleepTimer);
    }

    if (minutes === 'END_OF_SURAH') {
      set({isEndOfSurahTimer: true, sleepTimer: null, sleepTimerEnd: null});
    } else {
      const timer = setTimeout(
        () => {
          TrackPlayer.stop();
          set({
            sleepTimer: null,
            sleepTimerEnd: null,
            isEndOfSurahTimer: false,
          });
        },
        minutes * 60 * 1000,
      );

      const endTime = Date.now() + minutes * 60 * 1000;
      set({
        sleepTimer: timer,
        sleepTimerEnd: endTime,
        isEndOfSurahTimer: false,
      });
    }
  },
  clearSleepTimer: () => {
    const {sleepTimer} = get();
    if (sleepTimer) {
      clearTimeout(sleepTimer);
      set({sleepTimer: null, sleepTimerEnd: null});
    }
  },

  setPlaybackSpeed: async speed => {
    try {
      await TrackPlayer.setRate(speed);
      set({playbackSpeed: speed});
    } catch (error) {
      console.error('Error setting playback speed:', error);
    }
  },

  toggleRepeatMode: () => {
    const currentMode = get().repeatMode;
    let newMode: 'off' | 'all' | 'once';
    if (currentMode === 'off') {
      newMode = 'all';
    } else if (currentMode === 'all') {
      newMode = 'once';
    } else {
      newMode = 'off';
    }
    set({repeatMode: newMode});
    TrackPlayer.setRepeatMode(
      newMode === 'off'
        ? RepeatMode.Off
        : newMode === 'all'
          ? RepeatMode.Queue
          : RepeatMode.Track,
    );
  },

  handleTrackEnd: () => {
    const {isEndOfSurahTimer} = get();
    if (isEndOfSurahTimer) {
      TrackPlayer.stop();
      set({isEndOfSurahTimer: false});
    }
  },
}));
