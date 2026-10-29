// @ai-generated
import {SheetManager, getSheetStack} from 'react-native-actions-sheet';
import {
  closeFullPlayer,
  closeTopSheet,
  seekBy,
  skipTrack,
  togglePlayback,
  toggleRecitation,
} from '../keyActions';
import {mushafAudioService} from '@/services/audio/MushafAudioService';

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hide: jest.fn(), show: jest.fn()},
  getSheetStack: jest.fn(() => []),
}));

const mockPlayer = {
  sheetMode: 'hidden' as 'hidden' | 'mini' | 'full',
  queue: {tracks: [{id: 'a'}, {id: 'b'}] as unknown[], currentIndex: 0},
  loading: {trackLoading: false},
  playback: {state: 'paused', position: 10},
  setSheetMode: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  skipToNext: jest.fn(),
  skipToPrevious: jest.fn(),
};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => mockPlayer},
}));

const mockRecitation = {
  playbackState: 'idle' as 'idle' | 'loading' | 'playing' | 'paused',
  setPlaybackState: jest.fn(),
};
const mockSetRecitation = jest.fn();
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {
    getState: () => mockRecitation,
    setState: (s: unknown) => mockSetRecitation(s),
  },
}));
jest.mock('@/services/audio/MushafAudioService', () => ({
  mushafAudioService: {play: jest.fn(), pause: jest.fn()},
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.sheetMode = 'hidden';
  mockPlayer.queue = {tracks: [{id: 'a'}, {id: 'b'}], currentIndex: 0};
  mockPlayer.loading.trackLoading = false;
  mockPlayer.playback = {state: 'paused', position: 10};
  mockRecitation.playbackState = 'idle';
});

describe('closing', () => {
  it('hides the sheet on top of the stack', () => {
    (getSheetStack as jest.Mock).mockReturnValueOnce([
      {id: 'under', context: 'global'},
      {id: 'top', context: 'reader'},
    ]);
    expect(closeTopSheet()).toBe(true);
    expect(SheetManager.hide).toHaveBeenCalledWith('top', {context: 'reader'});
    expect(closeTopSheet()).toBe(false);
  });

  it('closes the full player only', () => {
    expect(closeFullPlayer()).toBe(false);
    mockPlayer.sheetMode = 'full';
    expect(closeFullPlayer()).toBe(true);
    expect(mockPlayer.setSheetMode).toHaveBeenCalledWith('hidden');
  });
});

describe('playback', () => {
  it('plays or pauses', () => {
    togglePlayback();
    expect(mockPlayer.play).toHaveBeenCalled();
    mockPlayer.playback.state = 'playing';
    togglePlayback();
    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('seeks, stopping at the start', () => {
    seekBy(15);
    expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(25);
    seekBy(-15);
    expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(0);
  });

  it('does not skip past the last track', () => {
    skipTrack(1);
    expect(mockPlayer.skipToNext).toHaveBeenCalledTimes(1);
    mockPlayer.queue.currentIndex = 1;
    skipTrack(1);
    expect(mockPlayer.skipToNext).toHaveBeenCalledTimes(1);
    skipTrack(-1);
    expect(mockPlayer.skipToPrevious).toHaveBeenCalled();
  });

  it('does nothing while a track loads or with no track', () => {
    mockPlayer.loading.trackLoading = true;
    togglePlayback();
    seekBy(15);
    mockPlayer.loading.trackLoading = false;
    mockPlayer.queue = {tracks: [], currentIndex: 0};
    skipTrack(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockPlayer.skipToNext).not.toHaveBeenCalled();
  });
});

describe('toggleRecitation', () => {
  it('pauses and resumes the recitation', () => {
    mockRecitation.playbackState = 'playing';
    toggleRecitation(5);
    expect(mushafAudioService.pause).toHaveBeenCalled();
    expect(mockRecitation.setPlaybackState).toHaveBeenLastCalledWith('paused');
    mockRecitation.playbackState = 'paused';
    toggleRecitation(5);
    expect(mushafAudioService.play).toHaveBeenCalled();
    expect(mockRecitation.setPlaybackState).toHaveBeenLastCalledWith('playing');
  });

  it('opens the playback options for the page with nothing loaded', () => {
    toggleRecitation(42);
    expect(mockSetRecitation).toHaveBeenCalledWith({currentPage: 42});
    expect(SheetManager.show).toHaveBeenCalledWith('mushaf-player-options', {
      payload: {currentPage: 42},
    });
  });

  it('waits while the recitation loads', () => {
    mockRecitation.playbackState = 'loading';
    toggleRecitation(42);
    expect(SheetManager.show).not.toHaveBeenCalled();
    expect(mushafAudioService.play).not.toHaveBeenCalled();
  });
});
