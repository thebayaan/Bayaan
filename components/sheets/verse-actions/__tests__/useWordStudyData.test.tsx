// @ai-generated
/**
 * Word Study's data hooks (useWordStudyData.ts) over mocked services: the
 * order of the loads, parallel parts, an i'rab failure kept to its part, a
 * failure of the words with a retry, no reload for the same parts, the
 * mushaf text quoted for each word, the gharib / rasm of the current verse,
 * and the books loaded only once their tab opens. Hafs slots are the real
 * ones of the verse-units fixture.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {WBWWord} from '@/services/wbw/WBWDataService';
import type {VerseWordStudy} from '@/services/wordStudy/wordStudyFormat';

const mockLog: string[] = [];
const mockDk = {ready: true, words: new Map<string, DKWordInfo[]>()};
const mockWbw = new Map<string, WBWWord[]>();

jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {initialize: jest.fn(), getVerseWords: jest.fn()},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    isRewayahReady: jest.fn(),
    ensureRewayahLoaded: jest.fn(),
    tryGetVerseWords: jest.fn(),
  },
}));
jest.mock('@/services/irab/IrabDataService', () => ({
  irabDataService: {getVerse: jest.fn(), getBooks: jest.fn()},
}));
jest.mock('@/services/wordStudy/WordStudyDataService', () => ({
  wordStudyDataService: {getVerse: jest.fn()},
}));

import {wbwDataService} from '@/services/wbw/WBWDataService';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {irabDataService} from '@/services/irab/IrabDataService';
import {wordStudyDataService} from '@/services/wordStudy/WordStudyDataService';
import type {WordStudyPart} from '../verseUnitScreens';
import {
  partsSignature,
  useIrabBooks,
  useVerseWordStudy,
  useWordStudyData,
  type IrabBooksState,
  type WordStudyData,
} from '../useWordStudyData';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    locations: string[];
    texts: {hafs: string[]};
  };

/** The Hafs DigitalKhatt slots of a fixture verse, its marker included. */
function hafsSlots(verseKey: string): DKWordInfo[] {
  const out: DKWordInfo[] = [];
  fixture.locations.forEach((location, i) => {
    const [s, a, w] = location.split(':');
    if (`${s}:${a}` === verseKey) {
      out.push({
        text: fixture.texts.hafs[i],
        verseKey,
        wordPositionInVerse: Number(w),
      });
    }
  });
  return out;
}

/** Word-by-word words for a verse's slots (one per word slot). */
function wbwOf(verseKey: string): WBWWord[] {
  return hafsSlots(verseKey)
    .filter(slot => !slot.text.startsWith('۝'))
    .map((slot, i) => ({
      position: i + 1,
      textUthmani: slot.text,
      translation: `t${i + 1}`,
      transliteration: `tl${i + 1}`,
      audioUrl: '',
    }));
}

function withData(verseKeys: string[]) {
  mockDk.words = new Map(verseKeys.map(k => [k, hafsSlots(k)]));
  for (const key of verseKeys) mockWbw.set(key, wbwOf(key));
}

/** Flushes the pending promise chains of the mocks. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

beforeEach(() => {
  jest.restoreAllMocks();
  mockLog.length = 0;
  mockDk.ready = true;
  mockWbw.clear();
  // The services as they behave by default; a test overrides one call.
  (wbwDataService.initialize as jest.Mock)
    .mockReset()
    .mockImplementation(async () => {
      mockLog.push('wbw.initialize');
    });
  (wbwDataService.getVerseWords as jest.Mock)
    .mockReset()
    .mockImplementation(async (key: string) => {
      mockLog.push(`wbw ${key}`);
      return mockWbw.get(key) ?? [];
    });
  (digitalKhattDataService.isRewayahReady as jest.Mock)
    .mockReset()
    .mockImplementation(() => mockDk.ready);
  (digitalKhattDataService.ensureRewayahLoaded as jest.Mock)
    .mockReset()
    .mockImplementation(async () => {
      mockLog.push('dk.ensure');
      mockDk.ready = true;
    });
  (digitalKhattDataService.tryGetVerseWords as jest.Mock)
    .mockReset()
    .mockImplementation((key: string) => {
      mockLog.push(`dk ${key}`);
      if (!mockDk.ready) return null;
      return mockDk.words.get(key) ?? [];
    });
  (irabDataService.getVerse as jest.Mock)
    .mockReset()
    .mockImplementation(async (key: string) => {
      mockLog.push(`irab ${key}`);
      return [];
    });
  (irabDataService.getBooks as jest.Mock)
    .mockReset()
    .mockImplementation(async (key: string) => [
      {bookId: 1, nameAr: `كتاب ${key}`, authorAr: 'مؤلف', passages: []},
    ]);
  (wordStudyDataService.getVerse as jest.Mock).mockReset();
});

function renderData(parts: WordStudyPart[]) {
  const seen: WordStudyData[] = [];
  function Probe({value}: {value: WordStudyPart[]}) {
    seen.push(useWordStudyData(value));
    return null;
  }
  act(() => {
    renderer = TestRenderer.create(<Probe value={parts} />);
  });
  return {
    seen,
    latest: () => seen[seen.length - 1],
    rerender(next: WordStudyPart[]) {
      act(() => renderer?.update(<Probe value={next} />));
    },
  };
}

describe('useWordStudyData', () => {
  it('opens the word-by-word data and the Hafs words before reading any part', async () => {
    withData(['1:5', '1:6']);
    mockDk.ready = false;
    const probe = renderData([
      {verseKey: '1:5', caption: 'verse'},
      {verseKey: '1:6', caption: 'verse'},
    ]);
    expect(probe.latest()).toEqual({status: 'loading'});
    await settle();
    expect(mockLog.slice(0, 2)).toEqual(['wbw.initialize', 'dk.ensure']);
    expect(digitalKhattDataService.ensureRewayahLoaded).toHaveBeenCalledWith(
      'hafs',
    );
    expect(probe.latest().status).toBe('ready');
  });

  it('does not ask for the Hafs words when they are in memory', async () => {
    withData(['1:5']);
    renderData([{verseKey: '1:5', caption: 'none'}]);
    await settle();
    expect(digitalKhattDataService.ensureRewayahLoaded).not.toHaveBeenCalled();
  });

  it('loads the parts in parallel and builds the sequence across them', async () => {
    withData(['1:6', '1:7']);
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    (wbwDataService.getVerseWords as jest.Mock).mockImplementation(
      async (key: string) => {
        mockLog.push(`wbw ${key}`);
        await gate;
        return mockWbw.get(key) ?? [];
      },
    );
    const probe = renderData([
      {verseKey: '1:6', caption: 'verse'},
      {verseKey: '1:7', caption: 'verse'},
    ]);
    await settle();
    // Both verses were asked for before either answered.
    expect(mockLog.filter(l => l.startsWith('wbw 1:'))).toEqual([
      'wbw 1:6',
      'wbw 1:7',
    ]);
    expect(probe.latest().status).toBe('loading');
    release();
    await settle();
    const data = probe.latest();
    if (data.status !== 'ready') throw new Error('not ready');
    expect(data.parts.map(p => p.part.verseKey)).toEqual(['1:6', '1:7']);
    expect(data.sequence.map(w => `${w.verseKey}:${w.position}`)).toEqual([
      '1:6:1',
      '1:6:2',
      '1:6:3',
      '1:7:1',
      '1:7:2',
      '1:7:3',
      '1:7:4',
      '1:7:5',
      '1:7:6',
      '1:7:7',
      '1:7:8',
      '1:7:9',
    ]);
  });

  it("quotes every word of the verse in the mushaf's text, even outside the part", async () => {
    withData(['1:7']);
    // Warsh 1:6 holds Hafs 1:7 words 1-4 only.
    const probe = renderData([
      {verseKey: '1:7', caption: 'hafsVerse', wordRange: {first: 1, last: 4}},
    ]);
    await settle();
    const data = probe.latest();
    if (data.status !== 'ready') throw new Error('not ready');
    expect(data.sequence).toHaveLength(4);
    const slots = hafsSlots('1:7');
    const {wordText} = data.parts[0];
    expect(wordText.size).toBe(9);
    expect(wordText.get(6)).toBe(slots[5].text);
    // Never the end marker.
    expect([...wordText.values()].some(t => t.includes('۝'))).toBe(false);
  });

  it("an i'rab failure leaves the part ready, with no i'rab", async () => {
    withData(['1:5', '1:6']);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (irabDataService.getVerse as jest.Mock).mockImplementation(
      async (key: string) => {
        if (key === '1:6') throw new Error('no irab');
        return [];
      },
    );
    const probe = renderData([
      {verseKey: '1:5', caption: 'verse'},
      {verseKey: '1:6', caption: 'verse'},
    ]);
    await settle();
    const data = probe.latest();
    if (data.status !== 'ready') throw new Error('not ready');
    expect(data.parts.map(p => p.irab)).toEqual([[], null]);
    expect(data.sequence.length).toBeGreaterThan(0);
  });

  it('a failure of the words gives an error, and retry loads again', async () => {
    withData(['1:5']);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (wbwDataService.getVerseWords as jest.Mock).mockImplementationOnce(
      async () => {
        throw new Error('disk');
      },
    );
    const probe = renderData([{verseKey: '1:5', caption: 'none'}]);
    await settle();
    const failed = probe.latest();
    if (failed.status !== 'error') throw new Error('expected an error');
    act(() => failed.retry());
    expect(probe.latest()).toEqual({status: 'loading'});
    await settle();
    expect(probe.latest().status).toBe('ready');
    expect(wbwDataService.getVerseWords).toHaveBeenCalledTimes(2);
  });

  it('a failure to load the Hafs words gives an error', async () => {
    withData(['1:5']);
    mockDk.ready = false;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (
      digitalKhattDataService.ensureRewayahLoaded as jest.Mock
    ).mockImplementationOnce(async () => {
      throw new Error('no copy');
    });
    const probe = renderData([{verseKey: '1:5', caption: 'none'}]);
    await settle();
    expect(probe.latest().status).toBe('error');
    expect(wbwDataService.getVerseWords).not.toHaveBeenCalled();
  });

  it('the same parts in a new array do not load again', async () => {
    withData(['1:5']);
    const probe = renderData([{verseKey: '1:5', caption: 'none'}]);
    await settle();
    probe.rerender([{verseKey: '1:5', caption: 'none'}]);
    await settle();
    expect(wbwDataService.getVerseWords).toHaveBeenCalledTimes(1);
    expect(probe.latest().status).toBe('ready');
    // Other parts load, and show nothing of the old ones meanwhile.
    withData(['1:5', '1:6']);
    probe.rerender([{verseKey: '1:6', caption: 'none'}]);
    expect(probe.latest()).toEqual({status: 'loading'});
    await settle();
    const data = probe.latest();
    if (data.status !== 'ready') throw new Error('not ready');
    expect(data.parts[0].part.verseKey).toBe('1:6');
  });

  it('signs the parts by content', () => {
    expect(
      partsSignature([
        {verseKey: '1:7', caption: 'hafsVerse', wordRange: {first: 1, last: 4}},
        {verseKey: '1:8', caption: 'verse'},
      ]),
    ).toBe('1:7|hafsVerse|1-4,1:8|verse|');
  });
});

describe('useVerseWordStudy', () => {
  const study = (verseKey: string): VerseWordStudy => ({
    verseKey,
    gharib: [],
    rasm: [],
  });

  it("gives a verse's own data only, and drops an answer that came late", async () => {
    const pending = new Map<string, (v: VerseWordStudy) => void>();
    (wordStudyDataService.getVerse as jest.Mock).mockImplementation(
      (key: string) =>
        new Promise<VerseWordStudy>(resolve => pending.set(key, resolve)),
    );
    const seen: (VerseWordStudy | null)[] = [];
    function Probe({verseKey}: {verseKey: string | null}) {
      seen.push(useVerseWordStudy(verseKey));
      return null;
    }
    act(() => {
      renderer = TestRenderer.create(<Probe verseKey="1:5" />);
    });
    expect(seen[seen.length - 1]).toBeNull();
    act(() => renderer?.update(<Probe verseKey="1:6" />));
    await act(async () => pending.get('1:6')?.(study('1:6')));
    expect(seen[seen.length - 1]).toEqual(study('1:6'));
    // 1:5 answers after the screen moved on: not shown.
    await act(async () => pending.get('1:5')?.(study('1:5')));
    expect(seen[seen.length - 1]).toEqual(study('1:6'));
    act(() => renderer?.update(<Probe verseKey={null} />));
    expect(seen[seen.length - 1]).toBeNull();
  });
});

describe('useIrabBooks', () => {
  function renderBooks(keys: string[], enabled: boolean) {
    const seen: IrabBooksState[] = [];
    function Probe(props: {keys: string[]; enabled: boolean}) {
      seen.push(useIrabBooks(props.keys, props.enabled));
      return null;
    }
    act(() => {
      renderer = TestRenderer.create(<Probe keys={keys} enabled={enabled} />);
    });
    return {
      latest: () => seen[seen.length - 1],
      rerender(next: {keys: string[]; enabled: boolean}) {
        act(() => renderer?.update(<Probe {...next} />));
      },
    };
  }

  it('loads nothing until the books tab opens', async () => {
    const probe = renderBooks(['1:6', '1:7'], false);
    await settle();
    expect(probe.latest()).toEqual({status: 'idle'});
    expect(irabDataService.getBooks).not.toHaveBeenCalled();
    probe.rerender({keys: ['1:6', '1:7'], enabled: true});
    expect(probe.latest()).toEqual({status: 'loading'});
    await settle();
    const state = probe.latest();
    if (state.status !== 'ready') throw new Error('not ready');
    expect([...state.books.keys()]).toEqual(['1:6', '1:7']);
    expect(irabDataService.getBooks).toHaveBeenCalledTimes(2);
  });

  it('a failure gives an error with a working retry', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (irabDataService.getBooks as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('db');
    });
    const probe = renderBooks(['1:6'], true);
    await settle();
    const failed = probe.latest();
    if (failed.status !== 'error') throw new Error('expected an error');
    act(() => failed.retry());
    await settle();
    expect(probe.latest().status).toBe('ready');
  });
});
