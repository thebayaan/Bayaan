import {
  recordProgress,
  getContinueEntries,
  clearContinue,
} from './continueListeningStore';
import {storage} from './storage';

const entry = (
  reciterId: string,
  surahNumber: number,
  positionSeconds = 10,
) => ({
  reciterId,
  rewayahId: 'r1',
  surahNumber,
  positionSeconds,
  durationSeconds: 60,
});

beforeEach(() => storage.clearAll());

describe('continueListeningStore', () => {
  it('starts empty', () => {
    expect(getContinueEntries()).toEqual([]);
  });

  it('records one entry', () => {
    recordProgress(entry('a', 1));
    const got = getContinueEntries();
    expect(got).toHaveLength(1);
    expect(got[0].reciterId).toBe('a');
    expect(typeof got[0].updatedAt).toBe('number');
  });

  it('dedupes on reciterId+surahNumber (updates position)', () => {
    recordProgress(entry('a', 1, 5));
    recordProgress(entry('a', 1, 20));
    const got = getContinueEntries();
    expect(got).toHaveLength(1);
    expect(got[0].positionSeconds).toBe(20);
  });

  it('different surah same reciter = two entries', () => {
    recordProgress(entry('a', 1));
    recordProgress(entry('a', 2));
    expect(getContinueEntries()).toHaveLength(2);
  });

  it('caps at 10 entries, evicts oldest', () => {
    for (let i = 1; i <= 12; i++) recordProgress(entry('r', i));
    const got = getContinueEntries();
    expect(got).toHaveLength(10);
    expect(got.find(e => e.surahNumber === 1)).toBeUndefined();
    expect(got.find(e => e.surahNumber === 12)).toBeDefined();
  });

  it('sorts by updatedAt desc', async () => {
    recordProgress(entry('a', 1));
    await new Promise(r => setTimeout(r, 5));
    recordProgress(entry('b', 2));
    const got = getContinueEntries();
    expect(got[0].reciterId).toBe('b');
    expect(got[1].reciterId).toBe('a');
  });

  it('clearContinue empties the store', () => {
    recordProgress(entry('a', 1));
    clearContinue();
    expect(getContinueEntries()).toEqual([]);
  });
});
