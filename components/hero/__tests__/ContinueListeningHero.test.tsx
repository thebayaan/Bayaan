// @ai-generated
import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';

const mockUpdateQueue = jest.fn();
const mockPlay = jest.fn(async () => undefined);
const mockPause = jest.fn(async () => undefined);
jest.mock('@/hooks/usePlayerActions', () => ({
  usePlayerActions: () => ({
    updateQueue: mockUpdateQueue,
    play: mockPlay,
    pause: mockPause,
  }),
}));
const mockResumeRecent = jest.fn(async (_args: unknown) => undefined);
jest.mock('@/services/player/utils/resumeRecent', () => ({
  resumeRecent: (args: unknown) => mockResumeRecent(args),
}));
let mockRecentTracks: unknown[] = [];
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: (select: (state: unknown) => unknown) =>
    select({recentTracks: mockRecentTracks}),
}));
let mockPlayer = {
  queue: {currentIndex: -1, tracks: [] as unknown[]},
  playback: {position: 0, state: 'paused'},
};
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: (select: (state: unknown) => unknown) => select(mockPlayer),
}));
jest.mock('@/i18n/format', () => ({
  getReciterDisplayName: (r: {name: string}) => r.name,
  getSurahDisplayName: (s: {name: string}) => s.name,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {isDarkMode: false, colors: {text: '#000', background: '#fff'}},
  }),
}));
jest.mock('@/components/ReciterImage', () => ({ReciterImage: () => null}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => 'play',
  PauseIcon: () => 'pause',
}));
jest.mock('../random-recitation/backgrounds', () => ({
  renderFullWidthBackground: () => null,
  getTextColors: () => ({labelColor: '#000', subtitleColor: '#000'}),
}));

import {
  ContinueListeningHero,
  findResumableIndex,
} from '../ContinueListeningHero';

const recent = (id: number, extra: object = {}) => ({
  reciter: {id: 'r1', name: 'Reciter'},
  surah: {id, name: `Surah ${id}`},
  rewayatId: 'hafs',
  progress: 0.5,
  duration: 120,
  timestamp: 0,
  ...extra,
});

function render() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<ContinueListeningHero />);
  });
  return renderer;
}

async function press(renderer: ReactTestRenderer) {
  const card = renderer.root.find(
    node => typeof node.props.onPress === 'function',
  );
  await act(async () => {
    card.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecentTracks = [];
  mockPlayer = {
    queue: {currentIndex: -1, tracks: []},
    playback: {position: 0, state: 'paused'},
  };
});

it('skips uploads and entries without a reciter or surah', () => {
  expect(
    findResumableIndex([
      recent(1, {isUserUpload: true}),
      recent(2, {reciter: {id: '', name: ''}}),
      recent(3),
    ] as never),
  ).toBe(2);
  expect(findResumableIndex([])).toBe(-1);
});

it('renders nothing until something has been played', () => {
  expect(render().toJSON()).toBeNull();
});

it('resumes the last surah where it was left', async () => {
  mockRecentTracks = [recent(67)];
  const renderer = render();
  await press(renderer);
  expect(mockResumeRecent).toHaveBeenCalledWith(
    expect.objectContaining({
      reciterId: 'r1',
      surahId: 67,
      startPosition: 60,
      recentIndex: 0,
    }),
  );
});

it('plays and pauses the surah already in the player', async () => {
  mockRecentTracks = [recent(67)];
  mockPlayer = {
    queue: {currentIndex: 0, tracks: [{reciterId: 'r1', surahId: '67'}]},
    playback: {position: 30, state: 'playing'},
  };
  const renderer = render();
  expect(JSON.stringify(renderer.toJSON())).toContain('pause');
  await press(renderer);
  expect(mockPause).toHaveBeenCalledTimes(1);
  expect(mockResumeRecent).not.toHaveBeenCalled();

  mockPlayer = {...mockPlayer, playback: {position: 30, state: 'paused'}};
  const paused = render();
  expect(JSON.stringify(paused.toJSON())).not.toContain('pause');
  await press(paused);
  expect(mockPlay).toHaveBeenCalledTimes(1);
});
