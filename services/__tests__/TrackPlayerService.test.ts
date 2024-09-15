import TrackPlayer, {
  Event,
  RepeatMode,
  State,
  AppKilledPlaybackBehavior,
  Capability,
} from 'react-native-track-player';
import trackPlayerService from '../TrackPlayerService';
import {Track} from '../../types/audio';
import {EmitterSubscription} from 'react-native';

jest.mock('react-native-track-player', () => ({
  addEventListener: jest.fn(),
  setupPlayer: jest.fn().mockResolvedValue(undefined),
  updateOptions: jest.fn().mockResolvedValue(undefined),
  add: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn(),
  skip: jest.fn(),
  skipToNext: jest.fn(),
  skipToPrevious: jest.fn(),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  stop: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  getVolume: jest.fn(),
  setRate: jest.fn(),
  getRate: jest.fn(),
  setRepeatMode: jest.fn(),
  getRepeatMode: jest.fn(),
  getTrack: jest.fn(),
  getCurrentTrack: jest.fn(),
  getQueue: jest.fn(),
  removeUpcomingTracks: jest.fn(),
  getActiveTrack: jest.fn(),
  getPlaybackState: jest.fn(),
  getProgress: jest.fn(),
  Event: {
    PlaybackState: 'playbackState',
    PlaybackError: 'playbackError',
  },
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Buffering: 'buffering',
    Connecting: 'connecting',
  },
  RepeatMode: {
    Off: 0,
    Track: 1,
    Queue: 2,
  },
  AppKilledPlaybackBehavior: {
    StopPlaybackAndRemoveNotification: 'StopPlaybackAndRemoveNotification',
  },
  Capability: {
    Play: 'play',
    Pause: 'pause',
    SeekTo: 'seekTo',
    Skip: 'skip',
  },
  reset: jest.fn().mockResolvedValue(undefined),
  setQueue: jest.fn().mockResolvedValue(undefined),
}));

describe('TrackPlayerService', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Singleton behavior', () => {
    it('should always return the same instance', () => {
      const instance1 = trackPlayerService;
      const instance2 = trackPlayerService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Player setup', () => {
    it('should setup the player', async () => {
      await expect(trackPlayerService.setupPlayer()).resolves.not.toThrow();
      expect(TrackPlayer.setupPlayer).toHaveBeenCalled();
      expect(TrackPlayer.updateOptions).toHaveBeenCalledWith({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SeekTo,
          Capability.Skip,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause],
      });
    });

    it('should throw TrackPlayerError when setup fails', async () => {
      (TrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(
        new Error('Setup failed'),
      );
      await expect(trackPlayerService.setupPlayer()).rejects.toThrow(
        'Failed to setup player',
      );
    });
  });

  describe('Track management', () => {
    it('should load and play a track', async () => {
      const mockTrack: Track = {
        id: '1',
        url: 'https://example.com/track.mp3',
        title: 'Test Track',
        artist: 'Test Artist',
        reciterId: 'reciter1',
      };
      await expect(
        trackPlayerService.loadTrack(mockTrack),
      ).resolves.not.toThrow();
      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.add).toHaveBeenCalledWith(
        expect.objectContaining(mockTrack),
      );
      expect(TrackPlayer.play).toHaveBeenCalled();
    });

    it('should throw TrackPlayerError when loading track fails', async () => {
      const mockTrack: Track = {
        id: '1',
        url: 'https://example.com/track.mp3',
        title: 'Test Track',
        artist: 'Test Artist',
        reciterId: 'reciter1',
      };
      (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(
        new Error('Add failed'),
      );
      await expect(trackPlayerService.loadTrack(mockTrack)).rejects.toThrow(
        'Failed to load track',
      );
    });

    it('should add tracks to the queue', async () => {
      const tracks: Track[] = [
        {
          id: '1',
          url: 'https://example.com/audio1.mp3',
          title: 'Track 1',
          artist: 'Artist 1',
          reciterId: 'reciter1',
        },
        {
          id: '2',
          url: 'https://example.com/audio2.mp3',
          title: 'Track 2',
          artist: 'Artist 2',
          reciterId: 'reciter2',
        },
      ];
      await trackPlayerService.add(tracks);
      expect(TrackPlayer.add).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            url: 'https://example.com/audio1.mp3',
            title: 'Track 1',
            artist: 'Artist 1',
            reciterId: 'reciter1',
          }),
          expect.objectContaining({
            id: '2',
            url: 'https://example.com/audio2.mp3',
            title: 'Track 2',
            artist: 'Artist 2',
            reciterId: 'reciter2',
          }),
        ]),
      );
    });

    it('should set the queue', async () => {
      const mockTracks: Track[] = [
        {
          id: '1',
          url: 'https://example.com/track1.mp3',
          title: 'Track 1',
          artist: 'Artist 1',
          reciterId: 'reciter1',
        },
        {
          id: '2',
          url: 'https://example.com/track2.mp3',
          title: 'Track 2',
          artist: 'Artist 2',
          reciterId: 'reciter2',
        },
      ];
      await expect(
        trackPlayerService.setQueue(mockTracks),
      ).resolves.not.toThrow();
      expect(TrackPlayer.setQueue).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining(mockTracks[0]),
          expect.objectContaining(mockTracks[1]),
        ]),
      );
    });

    it('should throw TrackPlayerError when setting queue fails', async () => {
      const mockTracks: Track[] = [
        {
          id: '1',
          url: 'https://example.com/track1.mp3',
          title: 'Track 1',
          artist: 'Artist 1',
          reciterId: 'reciter1',
        },
        {
          id: '2',
          url: 'https://example.com/track2.mp3',
          title: 'Track 2',
          artist: 'Artist 2',
          reciterId: 'reciter2',
        },
      ];
      (TrackPlayer.setQueue as jest.Mock).mockRejectedValueOnce(
        new Error('Set queue failed'),
      );
      await expect(trackPlayerService.setQueue(mockTracks)).rejects.toThrow(
        'Failed to set queue',
      );
    });

    it('should pause playback', async () => {
      await trackPlayerService.pause();
      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('should stop playback', async () => {
      await trackPlayerService.stop();
      expect(TrackPlayer.stop).toHaveBeenCalled();
    });

    it('should skip to next track', async () => {
      await trackPlayerService.skipToNext();
      expect(TrackPlayer.skipToNext).toHaveBeenCalled();
    });

    it('should skip to previous track', async () => {
      await trackPlayerService.skipToPrevious();
      expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
    });
  });

  describe('Playback control', () => {
    it('should play, pause, and stop', async () => {
      await trackPlayerService.play();
      expect(TrackPlayer.play).toHaveBeenCalled();

      await trackPlayerService.pause();
      expect(TrackPlayer.pause).toHaveBeenCalled();

      await trackPlayerService.stop();
      expect(TrackPlayer.stop).toHaveBeenCalled();
    });

    it('should seek to a specific position', async () => {
      const position = 30; // 30 seconds
      await trackPlayerService.seekTo(position);
      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(position);
    });

    it('should skip to next and previous tracks', async () => {
      await trackPlayerService.skipToNext();
      expect(TrackPlayer.skipToNext).toHaveBeenCalled();

      await trackPlayerService.skipToPrevious();
      expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
    });

    it('should get position and duration', async () => {
      (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({
        position: 10,
        duration: 180,
      });

      const position = await trackPlayerService.getPosition();
      expect(position).toBe(10);

      const duration = await trackPlayerService.getDuration();
      expect(duration).toBe(180);
    });

    it('should get player state', async () => {
      (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({
        state: State.Playing,
      });

      const state = await trackPlayerService.getState();
      expect(state).toBe(State.Playing);
    });
  });

  describe('Playback information', () => {
    it('should get position', async () => {
      (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({
        position: 30,
        duration: 180,
      });
      const position = await trackPlayerService.getPosition();
      expect(position).toBe(30);
    });

    it('should get duration', async () => {
      (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({
        position: 30,
        duration: 180,
      });
      const duration = await trackPlayerService.getDuration();
      expect(duration).toBe(180);
    });

    it('should get player state', async () => {
      (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({
        state: State.Playing,
      });
      const state = await trackPlayerService.getState();
      expect(state).toBe(State.Playing);
    });
  });

  describe('Playback settings', () => {
    it('should set playback rate', async () => {
      await trackPlayerService.setRate(1.5);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.5);
    });

    it('should set and get repeat mode', async () => {
      await trackPlayerService.setRepeatMode(RepeatMode.Track);
      expect(TrackPlayer.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Track);

      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(
        RepeatMode.Track,
      );
      const mode = await trackPlayerService.getRepeatMode();
      expect(mode).toBe(RepeatMode.Track);
    });
  });

  describe('Queue management', () => {
    it('should get the queue', async () => {
      const mockQueue = [
        {id: '1', url: 'https://example.com/track1.mp3', title: 'Track 1'},
        {id: '2', url: 'https://example.com/track2.mp3', title: 'Track 2'},
      ];
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(mockQueue);
      const queue = await trackPlayerService.getQueue();
      expect(queue).toEqual(mockQueue);
    });

    it('should get the current track', async () => {
      const mockTrack = {id: '1', title: 'Current Track'};
      (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(mockTrack);
      const currentTrack = await trackPlayerService.getActiveTrack();
      expect(currentTrack).toEqual(mockTrack);
    });
  });

  describe('Event listeners', () => {
    it('should add a listener', () => {
      const mockListener = jest.fn();
      const mockSubscription: Partial<EmitterSubscription> = {
        remove: jest.fn(),
      };
      (TrackPlayer.addEventListener as jest.Mock).mockReturnValue(
        mockSubscription as EmitterSubscription,
      );

      const subscription = trackPlayerService.addListener(
        Event.PlaybackState,
        mockListener,
      );
      expect(TrackPlayer.addEventListener).toHaveBeenCalledWith(
        Event.PlaybackState,
        mockListener,
      );
      expect(subscription).toBe(mockSubscription);
    });

    it('should remove a listener', () => {
      const mockSubscription: Partial<EmitterSubscription> = {
        remove: jest.fn(),
      };
      trackPlayerService.removeListener(
        mockSubscription as EmitterSubscription,
      );
      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    it('should throw an error when removing a listener fails', () => {
      const mockSubscription: Partial<EmitterSubscription> = {
        remove: jest.fn().mockImplementation(() => {
          throw new Error('Remove listener failed');
        }),
      };

      expect(() =>
        trackPlayerService.removeListener(
          mockSubscription as EmitterSubscription,
        ),
      ).toThrow('Failed to remove listener');
    });
  });

  describe('Error handling', () => {
    it('should throw an error when adding an invalid track', async () => {
      const invalidTrack = {id: '1'} as Track; // Missing required fields
      await expect(trackPlayerService.add(invalidTrack)).rejects.toThrow(
        'Failed to add tracks',
      );
    });

    it('should throw an error when setting an invalid queue', async () => {
      const invalidTracks = [{id: '1'}, {id: '2'}] as Track[]; // Missing required fields
      await expect(trackPlayerService.setQueue(invalidTracks)).rejects.toThrow(
        'Failed to set queue',
      );
    });

    it('should throw an error when TrackPlayer.play fails', async () => {
      (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(
        new Error('Play failed'),
      );
      await expect(trackPlayerService.play()).rejects.toThrow(
        'Failed to play track',
      );
    });

    it('should throw an error when TrackPlayer.seekTo fails', async () => {
      (TrackPlayer.seekTo as jest.Mock).mockRejectedValueOnce(
        new Error('Seek failed'),
      );
      await expect(trackPlayerService.seekTo(30)).rejects.toThrow(
        'Failed to seek to position',
      );
    });

    it('should throw an error when TrackPlayer.getActiveTrack fails', async () => {
      (TrackPlayer.getActiveTrack as jest.Mock).mockRejectedValueOnce(
        new Error('Get active track failed'),
      );
      await expect(trackPlayerService.getActiveTrack()).rejects.toThrow(
        'Failed to get active track',
      );
    });

    it('should throw an error when TrackPlayer.setRepeatMode fails', async () => {
      (TrackPlayer.setRepeatMode as jest.Mock).mockRejectedValueOnce(
        new Error('Set repeat mode failed'),
      );
      await expect(
        trackPlayerService.setRepeatMode(RepeatMode.Track),
      ).rejects.toThrow('Failed to set repeat mode');
    });

    it('should throw an error when adding a listener fails', () => {
      (TrackPlayer.addEventListener as jest.Mock).mockImplementation(() => {
        throw new Error('Add listener failed');
      });

      expect(() =>
        trackPlayerService.addListener(Event.PlaybackState, jest.fn()),
      ).toThrow('Failed to add listener');
    });
  });
});
