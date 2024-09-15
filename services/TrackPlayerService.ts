import TrackPlayer, {
  Event,
  State,
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
  Track as TPTrack,
  PlaybackState,
  PlaybackProgressUpdatedEvent,
  PlaybackActiveTrackChangedEvent,
} from 'react-native-track-player';
import {Track, toTrackPlayerTrack} from '../types/audio';
import {EmitterSubscription} from 'react-native';

// Custom error types
class TrackPlayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackPlayerError';
  }
}

class TrackValidationError extends TrackPlayerError {
  constructor(message: string) {
    super(message);
    this.name = 'TrackValidationError';
  }
}

// Custom event types
type TrackChangedEvent = {
  type: 'trackChanged';
  track: TPTrack | null;
};

export type CustomTrackPlayerEvent =
  | PlaybackState
  | PlaybackProgressUpdatedEvent
  | TrackChangedEvent;

class TrackPlayerService {
  private static instance: TrackPlayerService;
  private isSetup = false;

  private constructor() {}

  public static getInstance(): TrackPlayerService {
    if (!TrackPlayerService.instance) {
      TrackPlayerService.instance = new TrackPlayerService();
    }
    return TrackPlayerService.instance;
  }

  private validateTrack(track: Track) {
    if (!track.id || !track.url || !track.title) {
      throw new TrackValidationError('Invalid track: missing required fields');
    }
  }

  async setupPlayer() {
    if (this.isSetup) {
      console.log('Player is already set up');
      return;
    }

    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SeekTo,
          Capability.Skip,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SeekTo,
          Capability.Skip,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        icon: require('../assets/images/app_icon.png'),
      });
      this.isSetup = true;
      console.log('Player setup completed');
    } catch (error) {
      console.error('Error setting up player:', error);
      throw new TrackPlayerError('Failed to setup player');
    }
  }

  async loadTrack(track: Track) {
    try {
      this.validateTrack(track);
      await TrackPlayer.reset();
      const trackPlayerTrack = toTrackPlayerTrack(track);
      await TrackPlayer.add(trackPlayerTrack);
      await TrackPlayer.play();
      console.log('Track loaded and playing:', track.title);
    } catch (error) {
      if (error instanceof TrackValidationError) {
        console.error('Track validation error:', error.message);
      } else {
        console.error('Error loading track:', error);
      }
      throw new TrackPlayerError('Failed to load track');
    }
  }

  async add(
    tracks: Track | Track[],
    insertBeforeIndex?: number,
  ): Promise<void> {
    try {
      const tracksArray = Array.isArray(tracks) ? tracks : [tracks];
      tracksArray.forEach(this.validateTrack);

      const trackPlayerTracks = tracksArray.map(toTrackPlayerTrack);

      if (insertBeforeIndex !== undefined) {
        await TrackPlayer.add(trackPlayerTracks, insertBeforeIndex);
      } else {
        await TrackPlayer.add(trackPlayerTracks);
      }
    } catch (error) {
      if (error instanceof TrackValidationError) {
        console.error('Track validation error:', error.message);
      } else {
        console.error('Error adding tracks:', error);
      }
      throw new TrackPlayerError('Failed to add tracks');
    }
  }

  async setQueue(tracks: Track[]): Promise<void> {
    try {
      tracks.forEach(this.validateTrack);
      await TrackPlayer.setQueue(tracks.map(toTrackPlayerTrack));
    } catch (error) {
      if (error instanceof TrackValidationError) {
        console.error('Track validation error:', error.message);
      } else {
        console.error('Error setting queue:', error);
      }
      throw new TrackPlayerError('Failed to set queue');
    }
  }

  async play() {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error playing track:', error);
      throw new TrackPlayerError('Failed to play track');
    }
  }

  async pause() {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error pausing track:', error);
      throw new TrackPlayerError('Failed to pause track');
    }
  }

  async stop() {
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Error stopping track:', error);
      throw new TrackPlayerError('Failed to stop track');
    }
  }

  async seekTo(position: number) {
    try {
      await TrackPlayer.seekTo(position);
    } catch (error) {
      console.error('Error seeking to position:', error);
      throw new TrackPlayerError('Failed to seek to position');
    }
  }

  async skipToNext() {
    try {
      await TrackPlayer.skipToNext();
    } catch (error) {
      console.error('Error skipping to next:', error);
      throw new TrackPlayerError('Failed to skip to next');
    }
  }

  async skipToPrevious() {
    try {
      await TrackPlayer.skipToPrevious();
    } catch (error) {
      console.error('Error skipping to previous:', error);
      throw new TrackPlayerError('Failed to skip to previous');
    }
  }

  async getPosition(): Promise<number> {
    try {
      const progress = await TrackPlayer.getProgress();
      return progress.position;
    } catch (error) {
      console.error('Error getting position:', error);
      throw new TrackPlayerError('Failed to get position');
    }
  }

  async getDuration(): Promise<number> {
    try {
      const progress = await TrackPlayer.getProgress();
      return progress.duration;
    } catch (error) {
      console.error('Error getting duration:', error);
      throw new TrackPlayerError('Failed to get duration');
    }
  }

  async getState(): Promise<State> {
    const playbackState = await TrackPlayer.getPlaybackState();
    return playbackState.state;
  }

  async getProgress(): Promise<{position: number; duration: number}> {
    return await TrackPlayer.getProgress();
  }

  addListener(
    event: Event,
    listener: (event: CustomTrackPlayerEvent) => void,
  ): EmitterSubscription {
    return TrackPlayer.addEventListener(event, e => {
      if (event === Event.PlaybackActiveTrackChanged) {
        const activeTrackChangedEvent = e as PlaybackActiveTrackChangedEvent;
        listener({
          type: 'trackChanged',
          track: activeTrackChangedEvent.track,
        } as TrackChangedEvent);
      } else {
        listener(e as CustomTrackPlayerEvent);
      }
    });
  }

  removeListener(subscription: EmitterSubscription): void {
    try {
      subscription.remove();
    } catch (error) {
      console.error('Error removing listener:', error);
      throw new TrackPlayerError('Failed to remove listener');
    }
  }

  async setRate(rate: number) {
    try {
      await TrackPlayer.setRate(rate);
    } catch (error) {
      console.error('Error setting rate:', error);
      throw new TrackPlayerError('Failed to set rate');
    }
  }

  async getQueue(): Promise<TPTrack[]> {
    try {
      return await TrackPlayer.getQueue();
    } catch (error) {
      console.error('Error getting queue:', error);
      throw new TrackPlayerError('Failed to get queue');
    }
  }

  async getActiveTrack(): Promise<TPTrack | null> {
    try {
      const track = await TrackPlayer.getActiveTrack();
      return track || null;
    } catch (error) {
      console.error('Error getting active track:', error);
      throw new TrackPlayerError('Failed to get active track');
    }
  }

  async setRepeatMode(mode: RepeatMode): Promise<RepeatMode> {
    try {
      return await TrackPlayer.setRepeatMode(mode);
    } catch (error) {
      console.error('Error setting repeat mode:', error);
      throw new TrackPlayerError('Failed to set repeat mode');
    }
  }

  async getRepeatMode(): Promise<RepeatMode> {
    try {
      return await TrackPlayer.getRepeatMode();
    } catch (error) {
      console.error('Error getting repeat mode:', error);
      throw new TrackPlayerError('Failed to get repeat mode');
    }
  }

  async reset() {
    try {
      await TrackPlayer.reset();
    } catch (error) {
      console.error('Error resetting player:', error);
      throw new TrackPlayerError('Failed to reset player');
    }
  }

  async getPlaybackState(): Promise<PlaybackState> {
    return await TrackPlayer.getPlaybackState();
  }

  async resetPlayer() {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.setupPlayer();
      console.log('TrackPlayer reset and reinitialized successfully');
    } catch (error) {
      console.error('Error resetting TrackPlayer:', error);
      throw new TrackPlayerError('Failed to reset TrackPlayer');
    }
  }
}

const instance = TrackPlayerService.getInstance();

export {TrackPlayerService};
export {Event, State};
export type {CustomTrackPlayerEvent as TrackPlayerEvent};
export type {PlaybackState, PlaybackProgressUpdatedEvent};
export {State as TrackPlayerState};
export default instance;
