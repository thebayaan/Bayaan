jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-audio', () => ({createAudioPlayer: jest.fn()}));
jest.mock('@/services/audio/AudioCoordinator', () => ({
  audioCoordinator: {sourceDidStop: jest.fn()},
}));
jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {},
}));
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {},
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({settings: {}}), setState: jest.fn()},
}));
jest.mock('@/services/audio/AmbientAudioService', () => ({
  ambientAudioService: {
    stop: jest.fn(),
    loadSound: jest.fn(),
    setVolume: jest.fn(),
    fadeIn: jest.fn(),
  },
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackAmbientToggled: jest.fn()},
}));
jest.mock('@/store/translationStore', () => ({
  useTranslationStore: {getState: () => ({downloadedMeta: []})},
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAudioPlayer} from 'expo-audio';
import {useMushafPlayerStore} from '@/store/mushafPlayerStore';
import {mushafAudioService} from '@/services/audio/MushafAudioService';
import {ambientAudioService} from '@/services/audio/AmbientAudioService';
import {useAmbientStore} from '@/store/ambientStore';
import {
  applyRemotePreferences,
  applySettingsDocuments,
  capturePreferenceMutations,
  captureSettingsDocuments,
} from '../qfSettingsSnapshot';

test('cloud quarter-speed survives real store application, persistence, playback load and recapture', async () => {
  const player = {
    loop: false,
    setPlaybackRate: jest.fn(),
    addListener: jest.fn(() => ({remove: jest.fn()})),
    pause: jest.fn(),
    remove: jest.fn(),
  };
  jest
    .mocked(createAudioPlayer)
    .mockReturnValue(player as unknown as ReturnType<typeof createAudioPlayer>);
  applyRemotePreferences({audio: {playbackRate: 0.25}});
  expect(useMushafPlayerStore.getState().rate).toBe(0.25);
  expect(
    capturePreferenceMutations().find(item => item.group === 'audio')?.value,
  ).toBe(0.25);
  const persisted = await AsyncStorage.getItem('mushaf-player-store');
  expect(JSON.parse(persisted!).state.rate).toBe(0.25);
  mushafAudioService.loadSurah(1, 'https://audio.example.test/dummy.mp3', []);
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.25, 'high');
  useMushafPlayerStore.setState({rate: 1});
  await AsyncStorage.setItem('mushaf-player-store', persisted!);
  await useMushafPlayerStore.persist.rehydrate();
  expect(useMushafPlayerStore.getState().rate).toBe(0.25);
  // Re-apply persisted cloud preference, which must never upload a fallback.
  applyRemotePreferences({audio: {playbackRate: 0.25}});
  expect(player.setPlaybackRate).toHaveBeenLastCalledWith(0.25, 'high');
  expect(
    capturePreferenceMutations().find(item => item.group === 'audio')?.value,
  ).toBe(0.25);
  applySettingsDocuments({audio: {verseRepeatCount: 0, rangeRepeatCount: 0}});
  expect(useMushafPlayerStore.getState()).toMatchObject({
    verseRepeatCount: 0,
    rangeRepeatCount: 0,
  });
  expect(captureSettingsDocuments().audio).toMatchObject({
    verseRepeatCount: 0,
    rangeRepeatCount: 0,
  });
  mushafAudioService.cleanup();
});

test('synced ambient preferences control active playback but never auto-start an idle device', () => {
  useAmbientStore.setState({
    currentSound: 'rain',
    volume: 0.3,
    isEnabled: false,
  });
  jest.clearAllMocks();
  applySettingsDocuments({audio: {ambientSound: 'forest', ambientVolume: 0.7}});
  expect(useAmbientStore.getState()).toMatchObject({
    currentSound: 'forest',
    volume: 0.7,
    isEnabled: false,
  });
  expect(ambientAudioService.loadSound).not.toHaveBeenCalled();
  expect(ambientAudioService.setVolume).toHaveBeenLastCalledWith(0.7);
  useAmbientStore.getState().setEnabled(true);
  jest.clearAllMocks();
  applySettingsDocuments({audio: {ambientSound: 'ocean', ambientVolume: 0.2}});
  expect(ambientAudioService.stop).toHaveBeenCalledTimes(1);
  expect(ambientAudioService.loadSound).toHaveBeenLastCalledWith('ocean');
  expect(ambientAudioService.setVolume).toHaveBeenLastCalledWith(0.2);
  expect(ambientAudioService.fadeIn).toHaveBeenCalledTimes(1);
  expect(useAmbientStore.getState()).toMatchObject({
    currentSound: 'ocean',
    volume: 0.2,
    isEnabled: true,
  });
  applySettingsDocuments({audio: {ambientSound: null}});
  expect(ambientAudioService.stop).toHaveBeenCalledTimes(2);
  expect(useAmbientStore.getState()).toMatchObject({
    currentSound: null,
    isEnabled: false,
  });
});
