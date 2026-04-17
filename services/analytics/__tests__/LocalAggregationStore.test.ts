const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
    getAllKeys: () => Array.from(mockStorage.keys()),
  }),
}));

import {LocalAggregationStore} from '../LocalAggregationStore';

let store: LocalAggregationStore;

beforeEach(() => {
  mockStorage.clear();
  store = new LocalAggregationStore();
});

describe('getToday', () => {
  it('returns YYYY-MM-DD format', () => {
    const today = store.getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addListeningTime', () => {
  const date = '2026-04-12';

  it('creates new daily aggregate when none exists', () => {
    store.addListeningTime(date, 5000, '1', 'reciter-a');
    const agg = store.getDailyAggregate(date);
    expect(agg).not.toBeNull();
    expect(agg!.listeningMs).toBe(5000);
    expect(agg!.date).toBe(date);
  });

  it('accumulates listening time on the same day', () => {
    store.addListeningTime(date, 5000, '1', 'reciter-a');
    store.addListeningTime(date, 3000, '2', 'reciter-b');
    const agg = store.getDailyAggregate(date);
    expect(agg!.listeningMs).toBe(8000);
  });

  it('tracks per-surah listening time', () => {
    store.addListeningTime(date, 5000, '1', 'reciter-a');
    store.addListeningTime(date, 3000, '1', 'reciter-a');
    store.addListeningTime(date, 2000, '2', 'reciter-a');
    const agg = store.getDailyAggregate(date);
    expect(agg!.surahs['1']).toBe(8000);
    expect(agg!.surahs['2']).toBe(2000);
  });

  it('tracks per-reciter listening time', () => {
    store.addListeningTime(date, 5000, '1', 'reciter-a');
    store.addListeningTime(date, 3000, '2', 'reciter-b');
    const agg = store.getDailyAggregate(date);
    expect(agg!.reciters['reciter-a']).toBe(5000);
    expect(agg!.reciters['reciter-b']).toBe(3000);
  });
});

describe('incrementMeaningfulListens', () => {
  it('increments the meaningful listens counter', () => {
    const date = '2026-04-12';
    store.incrementMeaningfulListens(date);
    store.incrementMeaningfulListens(date);
    const agg = store.getDailyAggregate(date);
    expect(agg!.meaningfulListens).toBe(2);
  });
});

describe('addPagesOpened and addPagesRead', () => {
  const date = '2026-04-12';

  it('tracks pages opened separately from pages read', () => {
    store.addPagesOpened(date, 5);
    store.addPagesRead(date, 3);
    const agg = store.getDailyAggregate(date);
    expect(agg!.pagesOpened).toBe(5);
    expect(agg!.pagesRead).toBe(3);
  });

  it('accumulates pages counts', () => {
    store.addPagesOpened(date, 5);
    store.addPagesOpened(date, 2);
    store.addPagesRead(date, 3);
    store.addPagesRead(date, 1);
    const agg = store.getDailyAggregate(date);
    expect(agg!.pagesOpened).toBe(7);
    expect(agg!.pagesRead).toBe(4);
  });
});

describe('incrementAdhkarSessions', () => {
  it('increments the adhkar sessions counter', () => {
    const date = '2026-04-12';
    store.incrementAdhkarSessions(date);
    store.incrementAdhkarSessions(date);
    store.incrementAdhkarSessions(date);
    const agg = store.getDailyAggregate(date);
    expect(agg!.adhkarSessions).toBe(3);
  });
});

describe('addTasbeehCount', () => {
  it('accumulates tasbeeh count', () => {
    const date = '2026-04-12';
    store.addTasbeehCount(date, 33);
    store.addTasbeehCount(date, 33);
    const agg = store.getDailyAggregate(date);
    expect(agg!.tasbeehCount).toBe(66);
  });
});

describe('Khatmah tracking', () => {
  it('starts a new khatmah', () => {
    store.startNewKhatmah();
    const progress = store.getKhatmahProgress();
    expect(progress).not.toBeNull();
    expect(progress!.surahsCompleted).toEqual([]);
    expect(progress!.completedAt).toBeUndefined();
  });

  it('marks a surah as completed', () => {
    store.startNewKhatmah();
    store.markSurahCompleted('1');
    store.markSurahCompleted('2');
    const progress = store.getKhatmahProgress();
    expect(progress!.surahsCompleted).toEqual(['1', '2']);
  });

  it('does not duplicate surah entries', () => {
    store.startNewKhatmah();
    store.markSurahCompleted('1');
    store.markSurahCompleted('1');
    const progress = store.getKhatmahProgress();
    expect(progress!.surahsCompleted).toEqual(['1']);
  });

  it('tracks completion when all 114 surahs are done', () => {
    store.startNewKhatmah();
    for (let i = 1; i <= 114; i++) {
      store.markSurahCompleted(String(i));
    }
    const progress = store.getKhatmahProgress();
    expect(progress!.surahsCompleted).toHaveLength(114);
    expect(progress!.completedAt).toBeDefined();
  });

  it('does not mark completedAt before all 114 surahs', () => {
    store.startNewKhatmah();
    for (let i = 1; i <= 113; i++) {
      store.markSurahCompleted(String(i));
    }
    const progress = store.getKhatmahProgress();
    expect(progress!.completedAt).toBeUndefined();
  });
});

describe('Listening goal', () => {
  it('defaults to 10 minutes', () => {
    expect(store.getListeningGoal()).toBe(10);
  });

  it('persists a custom goal', () => {
    store.setListeningGoal(30);
    expect(store.getListeningGoal()).toBe(30);

    // Verify persistence by creating a new store instance reading same MMKV
    const store2 = new LocalAggregationStore();
    expect(store2.getListeningGoal()).toBe(30);
  });
});

describe('getDailyAggregate', () => {
  it('returns null for a date with no data', () => {
    expect(store.getDailyAggregate('2020-01-01')).toBeNull();
  });
});
