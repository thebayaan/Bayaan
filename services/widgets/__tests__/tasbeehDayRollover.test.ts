// @ai-generated
// The Tasbeeh widget count across midnight with the app left in memory:
// the real adhkar store, the real sync of widget taps and the real snapshot
// input, over a stand-in for the counts table.
import type {PendingTasbeeh} from 'bayaan-widgets';

// dhikr_counts as the database keeps it: one row per dhikr with the local
// day of its last update. A row from an earlier day counts as zero.
const mockRows = new Map<string, {count: number; day: string}>();
let mockPending: PendingTasbeeh[] = [];
const mockFlush = jest.fn();

function mockTodayCount(id: string): number {
  const row = mockRows.get(id);
  return row && row.day === new Date().toDateString() ? row.count : 0;
}

jest.mock('@/services/adhkar/AdhkarService', () => ({
  adhkarService: {
    getAllCategories: async () => [],
    getGroupedCategories: async () => ({}),
    getSuperCategoriesBySection: async () => [],
    getSaved: async () => [],
    getAllCounts: async () => {
      const counts: Record<string, number> = {};
      for (const id of mockRows.keys()) {
        const count = mockTodayCount(id);
        if (count > 0) counts[id] = count;
      }
      return counts;
    },
    incrementDhikrCount: async (id: string) => {
      const count = mockTodayCount(id) + 1;
      mockRows.set(id, {count, day: new Date().toDateString()});
      return count;
    },
    resetDhikrCount: async (id: string) => {
      mockRows.set(id, {count: 0, day: new Date().toDateString()});
    },
  },
}));
jest.mock('bayaan-widgets', () => ({
  ...jest.requireActual('bayaan-widgets'),
  hasArtwork: () => false,
  takePendingTasbeeh: () => {
    const pending = mockPending;
    mockPending = [];
    return pending;
  },
}));
jest.mock('../syncWidgets', () => ({
  ARTWORK_KINDS: [],
  flushWidgetSnapshot: () => mockFlush(),
}));
jest.mock('../enabledWidgets', () => ({
  isWidgetEnabled: () => true,
  enabledKinds: (kinds: unknown[]) => kinds,
}));
jest.mock('@/data/reciterData', () => ({RECITERS: []}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {},
}));
jest.mock('@/services/dataService', () => ({getReciterByIdSync: () => null}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: () => ''}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {tracks: [], currentIndex: -1},
      playback: {state: 'paused', position: 0, duration: 0, rate: 1},
    }),
  },
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {getState: () => ({recentTracks: []})},
}));
jest.mock('@/store/reciterStore', () => ({
  useReciterStore: {getState: () => ({defaultReciter: {id: ''}})},
}));
jest.mock('@/store/themeStore', () => ({
  useThemeStore: {getState: () => ({themeMode: 'light'})},
}));
jest.mock('@/store/adhkarSessionStore', () => ({
  useAdhkarSessionStore: {getState: () => ({session: null})},
}));
jest.mock('@/services/mushaf/MushafSessionStore', () => ({
  mushafSessionStore: {
    getLastReadPage: () => null,
    getLastReadSurahId: () => null, // @ai
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: false},
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {},
}));
jest.mock('@/utils/quranPages', () => ({getSurahOfTheDay: () => ({id: 1})}));

import {useAdhkarStore} from '@/store/adhkarStore';
import {consumeTasbeehIncrements} from '../syncConfiguredWidgets';
import {collectSnapshotInput} from '../collectSnapshotInput';
import {DEFAULT_TASBEEH_DHIKR_ID as DHIKR} from '../buildCatalog';

const DAY_1 = '2026-10-10';
const DAY_2 = '2026-10-11';

// What the next snapshot gives the widget for the dhikr.
function widgetCount(): number {
  return collectSnapshotInput(new Date()).tasbeeh[DHIKR].count;
}

async function tapOnWidgetThenOpenApp(taps: number, day: string) {
  mockPending = [{dhikrId: DHIKR, count: taps, day}];
  await consumeTasbeehIncrements(new Date());
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 10, 20));
  mockRows.clear();
  mockPending = [];
  mockFlush.mockClear();
  useAdhkarStore.getState().reset();
  // App launch on day 1.
  await useAdhkarStore.getState().loadCategories();
});
afterEach(() => jest.useRealTimers());

it('shows the count synced from the widget', async () => {
  await tapOnWidgetThenOpenApp(33, DAY_1);
  expect(widgetCount()).toBe(33);
});

it('keeps a count that ends on the same total as the day before', async () => {
  await tapOnWidgetThenOpenApp(33, DAY_1);
  expect(widgetCount()).toBe(33);

  // The app stays in memory overnight.
  jest.setSystemTime(new Date(2026, 9, 11, 8));
  // Yesterday's 33 is not today's count.
  expect(widgetCount()).toBe(0);

  // 33 again on the widget, then the app is opened. This showed 0.
  mockFlush.mockClear();
  await tapOnWidgetThenOpenApp(33, DAY_2);
  expect(mockFlush).toHaveBeenCalledTimes(1);
  expect(widgetCount()).toBe(33);
  expect(useAdhkarStore.getState().dhikrCounts).toEqual({[DHIKR]: 33});
});

it('drops yesterday’s counts on the first open of a new day', async () => {
  await tapOnWidgetThenOpenApp(33, DAY_1);
  jest.setSystemTime(new Date(2026, 9, 11, 8));
  mockFlush.mockClear();
  // Opened with nothing tapped on the widget.
  await consumeTasbeehIncrements(new Date());
  expect(useAdhkarStore.getState().dhikrCounts).toEqual({});
  expect(mockFlush).toHaveBeenCalledTimes(1);
  expect(widgetCount()).toBe(0);
});

it('adds to today’s count on a second sync the same day', async () => {
  await tapOnWidgetThenOpenApp(10, DAY_1);
  await tapOnWidgetThenOpenApp(5, DAY_1);
  expect(widgetCount()).toBe(15);
});

it('starts from zero when the first taps of a new day differ', async () => {
  await tapOnWidgetThenOpenApp(33, DAY_1);
  jest.setSystemTime(new Date(2026, 9, 11, 8));
  await tapOnWidgetThenOpenApp(4, DAY_2);
  expect(widgetCount()).toBe(4);
});

it('uses the local day, not UTC', async () => {
  // 23:30 and 00:30 local are two days whatever the time zone.
  jest.setSystemTime(new Date(2026, 9, 10, 23, 30));
  await tapOnWidgetThenOpenApp(7, DAY_1);
  expect(widgetCount()).toBe(7);
  jest.setSystemTime(new Date(2026, 9, 11, 0, 30));
  expect(widgetCount()).toBe(0);
  await tapOnWidgetThenOpenApp(7, DAY_2);
  expect(widgetCount()).toBe(7);
});
