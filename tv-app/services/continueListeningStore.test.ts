import {
  recordProgress,
  getContinueEntries,
  getContinueListening,
  clearContinue,
  isFinishedProgress,
  MIN_PROGRESS_SECONDS,
  removeContinue,
} from './continueListeningStore';
import {storage} from './storage';

const KEY = 'bayaan_tv_continue';

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

  it('ignores progress below the 5s threshold', () => {
    recordProgress(entry('a', 1, MIN_PROGRESS_SECONDS - 1));
    expect(getContinueEntries()).toEqual([]);
  });

  it('records progress at exactly the 5s threshold', () => {
    recordProgress(entry('a', 1, MIN_PROGRESS_SECONDS));
    expect(getContinueEntries()).toHaveLength(1);
  });

  it('does not overwrite a real entry with sub-5s progress', () => {
    recordProgress(entry('a', 1, 30));
    recordProgress(entry('a', 1, 2));
    const got = getContinueEntries();
    expect(got).toHaveLength(1);
    expect(got[0].positionSeconds).toBe(30);
  });

  it('persists and re-reads through MMKV (round-trips the backing store)', () => {
    recordProgress(entry('a', 7, 42));
    // Confirm it was serialized to the backing store, not just held in memory.
    expect(storage.getString(KEY)).toBeDefined();
    const reread = getContinueListening();
    expect(reread).toHaveLength(1);
    expect(reread[0]).toMatchObject({
      reciterId: 'a',
      surahNumber: 7,
      positionSeconds: 42,
    });
  });

  it('getContinueListening returns entries sorted by recency', async () => {
    recordProgress(entry('a', 1));
    await new Promise(r => setTimeout(r, 5));
    recordProgress(entry('b', 2));
    const got = getContinueListening();
    expect(got[0].reciterId).toBe('b');
    expect(got[1].reciterId).toBe('a');
  });

  it('getContinueListening sorts defensively even if stored out of order', () => {
    storage.set(
      KEY,
      JSON.stringify([
        {
          reciterId: 'old',
          rewayahId: 'r1',
          surahNumber: 1,
          positionSeconds: 10,
          durationSeconds: 60,
          updatedAt: 100,
        },
        {
          reciterId: 'new',
          rewayahId: 'r1',
          surahNumber: 2,
          positionSeconds: 10,
          durationSeconds: 60,
          updatedAt: 200,
        },
      ]),
    );
    const got = getContinueListening();
    expect(got[0].reciterId).toBe('new');
    expect(got[1].reciterId).toBe('old');
  });

  it('isFinishedProgress: 97% through or within 15 s of the end', () => {
    // A long surah: 97% comes first.
    expect(isFinishedProgress(2909, 3000)).toBe(false);
    expect(isFinishedProgress(2910, 3000)).toBe(true);
    // A short one: the last 15 seconds come first.
    expect(isFinishedProgress(84, 100)).toBe(false);
    expect(isFinishedProgress(85, 100)).toBe(true);
    // Unknown duration never counts as finished.
    expect(isFinishedProgress(500, 0)).toBe(false);
  });

  it('a write near the end removes the entry instead of saving it', () => {
    recordProgress(entry('a', 1, 30));
    recordProgress({...entry('a', 1, 0), positionSeconds: 58});
    expect(getContinueEntries()).toEqual([]);
  });

  it('hides finished entries already in storage', () => {
    storage.set(
      KEY,
      JSON.stringify([
        {
          reciterId: 'done',
          rewayahId: 'r1',
          surahNumber: 1,
          positionSeconds: 59,
          durationSeconds: 60,
          updatedAt: 200,
        },
        {
          reciterId: 'open',
          rewayahId: 'r1',
          surahNumber: 2,
          positionSeconds: 10,
          durationSeconds: 60,
          updatedAt: 100,
        },
      ]),
    );
    expect(getContinueListening().map(e => e.reciterId)).toEqual(['open']);
  });

  it('removeContinue drops only that reciter and surah', () => {
    recordProgress(entry('a', 1));
    recordProgress(entry('a', 2));
    recordProgress(entry('b', 1));
    removeContinue('a', 1);
    const got = getContinueEntries().map(
      e => `${e.reciterId}:${e.surahNumber}`,
    );
    expect(got.sort()).toEqual(['a:2', 'b:1']);
  });
});
