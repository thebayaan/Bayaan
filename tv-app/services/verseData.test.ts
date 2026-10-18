import ikhlas from './__fixtures__/timings/hafs-112.json';
import {storage, writeJSON} from './storage';
import {
  cleanTranslationVerse,
  fetchTimings,
  fetchTranslation,
  getArabicVerses,
  getBasmala,
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
    expect(fetchImpl).toHaveBeenCalledWith(`${TIMESTAMP_CDN}/rw-1/112.json`);
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
  it("drops Saheeh's run-on dash, also from surahs cached before", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      response(200, {
        data: {ayahs: [{numberInSurah: 1, text: 'And He is competent -'}]},
      }),
    );
    expect(await fetchTranslation('en.sahih', 67, fetchImpl)).toEqual([
      'And He is competent',
    ]);
    writeJSON('bayaan_tv_tr_en.sahih_2', ['Guidance -', 'Who believe']);
    expect(await fetchTranslation('en.sahih', 2, fetchImpl)).toEqual([
      'Guidance',
      'Who believe',
    ]);
  });
});

describe('cleanTranslationVerse', () => {
  it('drops a trailing dash only, not one inside the verse', () => {
    expect(cleanTranslationVerse('Say, - He is Allah -')).toBe(
      'Say, - He is Allah',
    );
    expect(cleanTranslationVerse('well-known')).toBe('well-known');
    expect(cleanTranslationVerse('Allah — ')).toBe('Allah');
  });
});
