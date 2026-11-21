// @ai-generated
/**
 * WordReadingsService with a fake reader serving real rows of the bundled
 * index (wordReadingsFixture.json): one query per verse, caching and LRU,
 * words with no row, failures and retry, the info guard (format, member
 * order, the words DBs it was built from), malformed rows, subscribers.
 */
import {
  readingsAt,
  ReadingsGuardError,
  READINGS_WORDS_DB_FILES,
  WordReadingsService,
  type ReadingsDbReader,
  type ReadingsSlotRecord,
} from '../WordReadingsService';
import {
  parseReadingsInfo,
  ReadingsFormatError,
  READINGS_REWAYAT,
} from '../wordReadingsFormat';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

interface FixtureWord {
  verseKey: string;
  position: number;
  wordId: number;
  data: string | null;
}
const fixture = require('../__fixtures__/wordReadingsFixture.json') as {
  info: {key: string; value: string}[];
  words: FixtureWord[];
};
const BUNDLED_INPUTS = parseReadingsInfo(fixture.info).inputs;
const expectedInputs = () => BUNDLED_INPUTS;

class FakeReader implements ReadingsDbReader {
  info = fixture.info.map(row => ({...row}));
  rows = new Map<string, ReadingsSlotRecord[]>();
  infoReads = 0;
  verseReads: string[] = [];
  failInfo = 0;
  failVerse = new Map<string, number>();

  constructor() {
    for (const w of fixture.words) {
      if (w.data === null) continue;
      const list = this.rows.get(w.verseKey) ?? [];
      list.push({position: w.position, word_id: w.wordId, data: w.data});
      this.rows.set(w.verseKey, list);
    }
  }

  async readInfo() {
    this.infoReads += 1;
    if (this.failInfo > 0) {
      this.failInfo -= 1;
      throw new Error('database disk image is malformed');
    }
    return this.info;
  }

  async readVerse(verseKey: string) {
    this.verseReads.push(verseKey);
    const failures = this.failVerse.get(verseKey) ?? 0;
    if (failures > 0) {
      this.failVerse.set(verseKey, failures - 1);
      throw new Error('database disk image is malformed');
    }
    return this.rows.get(verseKey) ?? [];
  }
}

let reader: FakeReader;
let service: WordReadingsService;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  reader = new FakeReader();
  service = new WordReadingsService(reader, {expectedInputs});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('reading', () => {
  it('reads each verse with one query and serves its words from the cache', async () => {
    expect(service.getStatus('1:4')).toBe('idle');
    expect(service.peek('1:4')).toBeNull();
    const first = service.request('1:4');
    expect(service.getStatus('1:4')).toBe('loading');
    const again = service.request('1:4'); // shares the read in flight
    const [a, b] = await Promise.all([first, again]);
    expect(a).toBe(b);
    expect(service.getStatus('1:4')).toBe('ready');
    expect(service.peek('1:4')).toBe(a);

    const malik = await service.getWordReadings('1:4:1');
    expect(malik.groups.map(g => g.kind)).toEqual(['asHafs', 'differs']);
    await service.getWordReadings('1:4:2');
    await service.request('1:4');
    expect(reader.verseReads).toEqual(['1:4']);
    expect(reader.infoReads).toBe(1);
  });

  it('a word with no row reads alike in all 8 rewayat', async () => {
    const r = await service.getWordReadings('1:4:2');
    expect(r.alike).toBe(true);
    expect(r.positions).toEqual([2]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].members.map(m => m.rewayah)).toEqual([
      ...READINGS_REWAYAT,
    ]);
  });

  it('serves a word-by-word word over two DK slots and the two slots of a span', async () => {
    const joined = await service.getWbwWordReadings('2:181', 3);
    expect(joined.positions).toEqual([3, 4]);
    expect(joined.alike).toBe(true);
    const span = await service.getWbwWordReadings('40:26', 14);
    expect(span.positions).toEqual([13, 14]);
    expect(span.groups[1].text).toBe(
      (await service.getWordReadings('40:26:13')).groups[1].text,
    );
  });

  it('rejects a location that is not a word', async () => {
    await expect(service.getWordReadings('1:4')).rejects.toBeInstanceOf(
      ReadingsFormatError,
    );
  });
});

describe('failures', () => {
  it('a failed read reports error until retry, which recovers', async () => {
    reader.failVerse.set('1:4', 1);
    await expect(service.request('1:4')).resolves.toBeNull();
    expect(service.getStatus('1:4')).toBe('error');
    expect(service.getError('1:4')).toBeInstanceOf(Error);
    // request() does not read again by itself
    await expect(service.request('1:4')).resolves.toBeNull();
    expect(reader.verseReads).toEqual(['1:4']);

    const verse = await service.retry('1:4');
    expect(verse).not.toBeNull();
    expect(service.getStatus('1:4')).toBe('ready');
    expect(service.getError('1:4')).toBeNull();
  });

  it('getWordReadings rejects on a failed read and tries again on the next call', async () => {
    reader.failVerse.set('1:4', 1);
    await expect(service.getWordReadings('1:4:1')).rejects.toThrow(/malformed/);
    await expect(service.getWordReadings('1:4:1')).resolves.toMatchObject({
      verseKey: '1:4',
    });
  });

  it('a failed info read is tried again by the next load', async () => {
    reader.failInfo = 1;
    await expect(service.request('1:4')).resolves.toBeNull();
    expect(service.getStatus('1:4')).toBe('error');
    await expect(service.retry('1:4')).resolves.not.toBeNull();
    expect(reader.infoReads).toBe(2);
  });

  it('a malformed row fails its own word only', async () => {
    reader.rows.get('1:4')?.push({position: 2, word_id: 15, data: '{"t":'});
    const verse = await service.request('1:4');
    expect(service.getStatus('1:4')).toBe('ready');
    await expect(service.getWordReadings('1:4:2')).rejects.toBeInstanceOf(
      ReadingsFormatError,
    );
    await expect(service.getWordReadings('1:4:1')).resolves.toMatchObject({
      positions: [1],
    });
    if (!verse) throw new Error('verse not loaded');
    expect(() => readingsAt(verse, [2])).toThrow(ReadingsFormatError);
    expect(() => readingsAt(verse, [3])).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('the info guard: readings from another data build are never shown', () => {
  const refused = async (edit: (s: FakeReader) => void) => {
    edit(reader);
    await expect(service.request('1:4')).resolves.toBeNull();
    await expect(service.request('2:9')).resolves.toBeNull();
    expect(service.getStatus('1:4')).toBe('error');
    expect(service.getStatus('2:9')).toBe('error');
    expect(service.getError('1:4')).toBeInstanceOf(ReadingsGuardError);
    await expect(service.getWordReadings('1:4:1')).rejects.toBeInstanceOf(
      ReadingsGuardError,
    );
    // the guard is final for the instance: no verse is ever read
    expect(reader.verseReads).toEqual([]);
    expect(reader.infoReads).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  };
  const setInfo = (s: FakeReader, key: string, value: string) => {
    const row = s.info.find(r => r.key === key);
    if (!row) throw new Error(`no ${key}`);
    row.value = value;
  };

  it('refuses another format', () => refused(s => setInfo(s, 'format', '2')));

  it('refuses another member order', () =>
    refused(s =>
      setInfo(s, 'rewayat', [...READINGS_REWAYAT].reverse().join(',')),
    ));

  it('refuses an index built from other words DBs', () =>
    refused(s => {
      const inputs = {...BUNDLED_INPUTS, 'dk_words_warsh.db': '0'.repeat(64)};
      setInfo(s, 'inputs', JSON.stringify(inputs));
    }));

  it('refuses a malformed info table', () =>
    refused(s => {
      s.info = [];
    }));

  it('refuses when the bundled manifest lacks a words DB', async () => {
    const partial = Object.fromEntries(
      Object.entries(BUNDLED_INPUTS).filter(([f]) => f !== 'dk_words_soosi.db'),
    );
    service = new WordReadingsService(reader, {expectedInputs: () => partial});
    await refused(() => undefined);
  });

  it('by default checks the 8 words DBs against the bundled manifest, which the bundled index passes', async () => {
    expect(READINGS_WORDS_DB_FILES).toHaveLength(8);
    for (const file of READINGS_WORDS_DB_FILES) {
      expect(BUNDLED_INPUTS[file]).toMatch(/^[0-9a-f]{64}$/);
    }
    // the fixture's info is the bundled index's own (gen_word_readings_fixture.py)
    service = new WordReadingsService(reader);
    await expect(service.request('1:4')).resolves.not.toBeNull();
    expect(service.getStatus('1:4')).toBe('ready');
  });
});

describe('cache', () => {
  it('evicts the least recently requested verse past maxVerses', async () => {
    service = new WordReadingsService(reader, {expectedInputs, maxVerses: 2});
    await service.request('1:4');
    await service.request('2:9');
    await service.request('1:4'); // 1:4 is now the most recent
    await service.request('3:66'); // evicts 2:9
    expect(service.getStatus('2:9')).toBe('idle');
    expect(service.peek('2:9')).toBeNull();
    expect(service.getStatus('1:4')).toBe('ready');
    expect(service.getStatus('3:66')).toBe('ready');
    await service.request('2:9');
    expect(reader.verseReads).toEqual(['1:4', '2:9', '3:66', '2:9']);
  });

  it('notifies subscribers when a read starts and ends, and stops after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);
    const before = service.getVersion();
    const reading = service.request('1:4');
    expect(listener).toHaveBeenCalledTimes(1); // loading
    await reading;
    expect(listener).toHaveBeenCalledTimes(2); // ready
    expect(service.getVersion()).toBeGreaterThan(before);
    unsubscribe();
    await service.request('2:9');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
