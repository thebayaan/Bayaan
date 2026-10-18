import ikhlas from './__fixtures__/timings/hafs-112.json';
import {storage} from './storage';
import {
  fetchTimings,
  fetchTranslation,
  getArabicVerses,
  getBasmala,
  cleanTranslationText,
  FETCH_TIMEOUT_MS,
  TIMESTAMP_CDN,
} from './verseData';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('Arabic text', () => {
  it('has every verse of a surah in order', () => {
    const ikhlasText = getArabicVerses(112);
    expect(ikhlasText).toHaveLength(4);
    expect(getArabicVerses(2)).toHaveLength(286);
  });

  it('gives the basmala without its verse number', () => {
    const basmala = getBasmala();
    expect(basmala.length).toBeGreaterThan(10);
    expect(basmala).not.toMatch(/[٠-٩]/);
  });
});

describe('fetchTimings', () => {
  beforeEach(() => storage.clearAll());

  it('fetches the padded CDN path and caches the result', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, ikhlas));
    const first = await fetchTimings('rw-1', 112, fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${TIMESTAMP_CDN}/rw-1/112.json`);
    expect(first).toHaveLength(4);
    const second = await fetchTimings('rw-1', 112, fetchImpl);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('remembers a recitation with no timings', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(404, null));
    expect(await fetchTimings('rw-2', 1, fetchImpl)).toBeNull();
    expect(await fetchTimings('rw-2', 1, fetchImpl)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws on server errors so offline is not cached as missing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(500, null));
    await expect(fetchTimings('rw-3', 1, fetchImpl)).rejects.toThrow();
    fetchImpl.mockResolvedValue(response(200, ikhlas));
    expect(await fetchTimings('rw-3', 1, fetchImpl)).toHaveLength(4);
  });
});

describe('fetchTranslation', () => {
  beforeEach(() => storage.clearAll());

  it('orders verses by their number and caches them', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      response(200, {
        data: {
          ayahs: [
            {numberInSurah: 2, text: 'Two'},
            {numberInSurah: 1, text: 'One'},
          ],
        },
      }),
    );
    expect(await fetchTranslation('en.sahih', 108, fetchImpl)).toEqual([
      'One',
      'Two',
    ]);
    await fetchTranslation('en.sahih', 108, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("closes up Saheeh's run-on dash, fresh or cached", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      response(200, {
        data: {ayahs: [{numberInSurah: 1, text: 'Lord of the worlds -'}]},
      }),
    );
    expect(await fetchTranslation('en.sahih', 1, fetchImpl)).toEqual([
      'Lord of the worlds—',
    ]);
    expect(await fetchTranslation('en.sahih', 1, fetchImpl)).toEqual([
      'Lord of the worlds—',
    ]);
    expect(cleanTranslationText('pre-dawn')).toBe('pre-dawn');
    // A cached gap reads back as null and is passed over, not thrown on.
    expect(cleanTranslationText(null as unknown as string)).toBeNull();
  });

  it('gives up on a request that never answers', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(() => new Promise<Response>(() => undefined));
      const pending = fetchTranslation('en.sahih', 2, fetchImpl);
      jest.advanceTimersByTime(FETCH_TIMEOUT_MS);
      await expect(pending).rejects.toThrow('timed out');
    } finally {
      jest.useRealTimers();
    }
  });
});
