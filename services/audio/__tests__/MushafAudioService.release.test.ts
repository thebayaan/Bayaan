// @ai-generated
/**
 * A Mushaf player that is released gives the lock screen back first.
 *
 * On iOS a removed player that still held the entry stayed on the lock
 * screen after Stop (the app goes idle only after the player is gone, so
 * nothing else could clear it), and its play button started that surah
 * again with nothing in the app able to stop it.
 */

const mockCalls: string[] = [];

function mockMakePlayer() {
  return {
    loop: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    setPlaybackRate: jest.fn(),
    addListener: jest.fn(() => ({remove: jest.fn()})),
    play: jest.fn(),
    pause: jest.fn(() => void mockCalls.push('pause')),
    clearLockScreenControls: jest.fn(() => void mockCalls.push('clear')),
    remove: jest.fn(() => void mockCalls.push('remove')),
  };
}

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockMakePlayer(),
}));
jest.mock('../AudioCoordinator', () => ({
  audioCoordinator: {mushafWillPlay: jest.fn(), sourceDidStop: jest.fn()},
}));

import {mushafAudioService} from '../MushafAudioService';

beforeEach(() => {
  mockCalls.length = 0;
});

describe('MushafAudioService: releasing a player', () => {
  it('clears its lock screen entry before removing it, on Stop', () => {
    mushafAudioService.loadSurah(2, 'https://cdn.example.com/2.mp3', []);
    mockCalls.length = 0;

    mushafAudioService.stop();

    expect(mockCalls).toEqual(['pause', 'clear', 'remove']);
    expect(mushafAudioService.getPlayer()).toBeNull();
  });

  it('and when the next surah replaces it', () => {
    mushafAudioService.loadSurah(2, 'https://cdn.example.com/2.mp3', []);
    mockCalls.length = 0;

    mushafAudioService.loadSurah(3, 'https://cdn.example.com/3.mp3', []);

    expect(mockCalls).toEqual(['pause', 'clear', 'remove']);
    mushafAudioService.stop();
  });
});
