import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useReducer,
} from 'react';
import TrackPlayer, {useProgress} from 'react-native-track-player';
import trackPlayerService, {
  Event,
  TrackPlayerEvent,
  TrackPlayerState,
} from '../services/TrackPlayerService';
import {Track} from '../types/audio';
import {AppState, AppStateStatus} from 'react-native';

// Define action types
type Action =
  | {type: 'SET_IS_PLAYER_READY'; payload: boolean}
  | {type: 'SET_IS_PLAYING'; payload: boolean}
  | {type: 'SET_CURRENT_TRACK'; payload: Track | null}
  | {type: 'SET_ERROR_MESSAGE'; payload: string | null}
  | {type: 'SET_QUEUE'; payload: Track[]}
  | {type: 'ADD_TO_QUEUE'; payload: Track}
  | {type: 'REMOVE_FROM_QUEUE'; payload: string}
  | {type: 'CLEAR_QUEUE'}
  | {type: 'SET_PROGRESS'; payload: {position: number; duration: number}};

// Define the state type
interface State {
  isPlayerReady: boolean;
  isPlaying: boolean;
  currentTrack: Track | null;
  errorMessage: string | null;
  queue: Track[];
  progress: {
    position: number;
    duration: number;
  };
}

// Define the context type
interface AudioPlayerContextType extends State {
  initializePlayer: () => Promise<void>;
  loadAndPlayTrack: (track: Track, startPosition?: number) => Promise<void>;
  togglePlayback: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  seek: (amount: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  setQueue: (newQueue: Track[]) => Promise<void>;
  fastForward: () => Promise<void>;
  fastRewind: () => Promise<void>;
  stop: () => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined,
);

// Reducer function
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_IS_PLAYER_READY':
      return {...state, isPlayerReady: action.payload};
    case 'SET_IS_PLAYING':
      return {...state, isPlaying: action.payload};
    case 'SET_CURRENT_TRACK':
      return {...state, currentTrack: action.payload};
    case 'SET_ERROR_MESSAGE':
      return {...state, errorMessage: action.payload};
    case 'SET_QUEUE':
      return {...state, queue: action.payload};
    case 'ADD_TO_QUEUE':
      return {...state, queue: [...state.queue, action.payload]};
    case 'REMOVE_FROM_QUEUE':
      return {
        ...state,
        queue: state.queue.filter(track => track.id !== action.payload),
      };
    case 'CLEAR_QUEUE':
      return {...state, queue: []};
    case 'SET_PROGRESS':
      return {...state, progress: action.payload};
    default:
      return state;
  }
}

const handleError = (error: unknown, message: string): Error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`${message}: ${errorMessage}`);
  return new Error(`${message}: ${errorMessage}`);
};

export const AudioPlayerProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, {
    isPlayerReady: false,
    isPlaying: false,
    currentTrack: null,
    errorMessage: null,
    queue: [],
    progress: {position: 0, duration: 0},
  });

  const progress = useProgress(200); // Update every 200ms

  useEffect(() => {
    dispatch({
      type: 'SET_PROGRESS',
      payload: {position: progress.position, duration: progress.duration},
    });
  }, [progress.position, progress.duration]);

  const initializePlayer = useCallback(async () => {
    if (state.isPlayerReady) return;
    try {
      await trackPlayerService.setupPlayer();
      dispatch({type: 'SET_IS_PLAYER_READY', payload: true});
    } catch (error) {
      const audioError = handleError(
        error,
        'Failed to initialize audio player',
      );
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      console.error(audioError);
    }
  }, [state.isPlayerReady]);

  const loadAndPlayTrack = useCallback(
    async (track: Track, position?: number) => {
      if (!state.isPlayerReady) {
        throw handleError(
          new Error('Player is not ready'),
          'Failed to load track',
        );
      }
      try {
        const currentTrack = await TrackPlayer.getCurrentTrack();
        if (
          currentTrack !== null &&
          (await TrackPlayer.getTrack(currentTrack))?.id === track.id
        ) {
          // Track is already loaded, just seek and play
          if (position !== undefined) {
            await TrackPlayer.seekTo(position);
          }
          await TrackPlayer.play();
        } else {
          // Load new track
          await TrackPlayer.reset();
          await TrackPlayer.add([track]);
          if (position !== undefined) {
            await TrackPlayer.seekTo(position);
          }
          await TrackPlayer.play();
        }
        dispatch({type: 'SET_CURRENT_TRACK', payload: track});
        dispatch({type: 'SET_IS_PLAYING', payload: true});
      } catch (error) {
        throw handleError(error, 'Failed to load and play track');
      }
    },
    [state.isPlayerReady],
  );

  const togglePlayback = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      if (state.isPlaying) {
        await trackPlayerService.pause();
      } else {
        await trackPlayerService.play();
      }
      dispatch({type: 'SET_IS_PLAYING', payload: !state.isPlaying});
    } catch (error) {
      const audioError = handleError(error, 'Failed to toggle playback');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlaying, state.isPlayerReady]);

  const seekTo = useCallback(
    async (position: number) => {
      if (!state.isPlayerReady) return;
      try {
        await TrackPlayer.seekTo(position);
      } catch (error) {
        const audioError = handleError(error, 'Failed to seek');
        dispatch({
          type: 'SET_ERROR_MESSAGE',
          payload: audioError.message,
        });
        throw audioError;
      }
    },
    [state.isPlayerReady],
  );

  const seek = useCallback(
    async (amount: number) => {
      if (!state.isPlayerReady) return;
      try {
        const position = await trackPlayerService.getPosition();
        await trackPlayerService.seekTo(Math.max(0, position + amount));
      } catch (error) {
        const audioError = handleError(error, 'Failed to seek');
        dispatch({
          type: 'SET_ERROR_MESSAGE',
          payload: audioError.message,
        });
        throw audioError;
      }
    },
    [state.isPlayerReady],
  );

  const playNext = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      await trackPlayerService.skipToNext();
      const newTrack = await trackPlayerService.getActiveTrack();
      if (newTrack) {
        dispatch({type: 'SET_CURRENT_TRACK', payload: newTrack as Track});
      }
    } catch (error) {
      const audioError = handleError(error, 'Failed to play next track');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlayerReady]);

  const playPrevious = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      await trackPlayerService.skipToPrevious();
      const newTrack = await trackPlayerService.getActiveTrack();
      if (newTrack) {
        dispatch({type: 'SET_CURRENT_TRACK', payload: newTrack as Track});
      }
    } catch (error) {
      const audioError = handleError(error, 'Failed to play previous track');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlayerReady]);

  const addToQueue = useCallback(async (track: Track) => {
    try {
      await trackPlayerService.add(track);
      dispatch({type: 'ADD_TO_QUEUE', payload: track});
    } catch (error) {
      const audioError = handleError(error, 'Failed to add track to queue');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    dispatch({type: 'REMOVE_FROM_QUEUE', payload: trackId});
  }, []);

  const clearQueue = useCallback(() => {
    dispatch({type: 'CLEAR_QUEUE'});
  }, []);

  const setQueue = useCallback(async (newQueue: Track[]) => {
    try {
      await trackPlayerService.setQueue(newQueue);
      dispatch({type: 'SET_QUEUE', payload: newQueue});
    } catch (error) {
      const audioError = handleError(error, 'Failed to set queue');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, []);

  const fastForward = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      await trackPlayerService.setRate(2.0);
    } catch (error) {
      const audioError = handleError(error, 'Failed to fast forward');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlayerReady]);

  const fastRewind = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      await trackPlayerService.setRate(-2.0);
    } catch (error) {
      const audioError = handleError(error, 'Failed to fast rewind');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlayerReady]);

  const stop = useCallback(async () => {
    if (!state.isPlayerReady) return;
    try {
      await trackPlayerService.stop();
      dispatch({type: 'SET_IS_PLAYING', payload: false});
    } catch (error) {
      const audioError = handleError(error, 'Failed to stop playback');
      dispatch({
        type: 'SET_ERROR_MESSAGE',
        payload: audioError.message,
      });
      throw audioError;
    }
  }, [state.isPlayerReady]);

  useEffect(() => {
    let isInitialized = false;

    const initialize = async () => {
      if (!isInitialized) {
        await initializePlayer();
        isInitialized = true;
      }
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Reset and re-initialize when app comes to foreground
        await trackPlayerService.resetPlayer();
        dispatch({type: 'SET_IS_PLAYER_READY', payload: true});
      } else if (nextAppState === 'background') {
        // Stop playback and reset player when app goes to background
        await stop();
        await trackPlayerService.reset();
        dispatch({type: 'SET_IS_PLAYER_READY', payload: false});
      }
    };

    initialize();

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    const playbackStateListener = trackPlayerService.addListener(
      Event.PlaybackState,
      (event: TrackPlayerEvent) => {
        if ('state' in event) {
          dispatch({
            type: 'SET_IS_PLAYING',
            payload: event.state === TrackPlayerState.Playing,
          });
        }
      },
    );

    const trackChangedListener = trackPlayerService.addListener(
      Event.PlaybackActiveTrackChanged,
      async (event: TrackPlayerEvent) => {
        if (
          'type' in event &&
          event.type === 'trackChanged' &&
          event.track !== null
        ) {
          dispatch({type: 'SET_CURRENT_TRACK', payload: event.track as Track});
        }
      },
    );

    return () => {
      playbackStateListener.remove();
      trackChangedListener.remove();
      appStateSubscription.remove();
      TrackPlayer.reset();
    };
  }, [initializePlayer, stop]);

  const contextValue: AudioPlayerContextType = {
    ...state,
    initializePlayer,
    loadAndPlayTrack,
    togglePlayback,
    seekTo,
    seek,
    playNext,
    playPrevious,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setQueue,
    fastForward,
    fastRewind,
    stop,
    progress,
  };

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayerContext = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error(
      'useAudioPlayerContext must be used within an AudioPlayerProvider',
    );
  }
  return context;
};
