// @ai-generated
// Copy/share text must be the text of the rewayah it is labelled with: wait
// for a side cache, report failure, never substitute Hafs for a non-Hafs
// request. Fixtures use placeholder words (W1, W2, ...) with real verse-end
// markers (U+06DD + Arabic-Indic digits) rather than Quran text.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {
  useRewayahVerseTexts,
  type UseRewayahVerseTextsResult,
} from '../useRewayahVerseTexts';
import {
  formatQuranCitation,
  formatVerseRange,
  getBundledHafsVerseText,
  isRewayahTextLoaded,
  joinVerseTexts,
  readLoadedVerseTexts,
  resolveVerseTexts,
  waitForRewayahText,
  watchRewayahText,
} from '../rewayahVerseText';

jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  type MockWord = {
    text: string;
    verseKey: string;
    wordPositionInVerse: number;
  };
  type MockVerses = Map<string, MockWord[]>;
  const listeners = new Set<() => void>();
  const state = {
    current: 'hafs',
    version: 0,
    main: new Map() as MockVerses,
    side: new Map<string, MockVerses>(),
    pendingSide: new Map<
      string,
      {resolve: () => void; reject: (err: Error) => void}
    >(),
  };
  const notify = () => {
    state.version += 1;
    for (const listener of [...listeners]) listener();
  };
  const service = {
    get rewayah() {
      return state.current;
    },
    get initialized() {
      return true;
    },
    getVerseWords(verseKey: string, rewayah?: string): MockWord[] {
      if (!rewayah || rewayah === state.current) {
        return state.main.get(verseKey) ?? [];
      }
      return state.side.get(rewayah)?.get(verseKey) ?? [];
    },
    // Contract: blank word slots contribute nothing (rt-overlay's join).
    getVerseText(verseKey: string, rewayah?: string): string {
      return service
        .getVerseWords(verseKey, rewayah)
        .filter(w => w.text !== '')
        .map(w => w.text)
        .join(' ');
    },
    subscribeCacheChanges: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getCacheVersion: () => state.version,
    ensureRewayahLoaded: jest.fn(
      (rewayah: string) =>
        new Promise<void>((resolve, reject) => {
          if (rewayah === state.current || state.side.has(rewayah)) {
            resolve();
            return;
          }
          state.pendingSide.set(rewayah, {resolve, reject});
        }),
    ),
  };
  const toVerses = (slots: Record<string, string[]>): MockVerses => {
    const verses: MockVerses = new Map();
    for (const [verseKey, texts] of Object.entries(slots)) {
      verses.set(
        verseKey,
        texts.map((text, i) => ({text, verseKey, wordPositionInVerse: i + 1})),
      );
    }
    return verses;
  };
  return {
    digitalKhattDataService: service,
    __test: {
      state,
      listeners,
      notify,
      toVerses,
      reset(current: string, main: Record<string, string[]>) {
        state.current = current;
        state.main = toVerses(main);
        state.side.clear();
        state.pendingSide.clear();
        listeners.clear();
        service.ensureRewayahLoaded.mockClear();
      },
      finishSideLoad(rewayah: string, slots: Record<string, string[]>) {
        state.side.set(rewayah, toVerses(slots));
        notify();
        state.pendingSide.get(rewayah)?.resolve();
        state.pendingSide.delete(rewayah);
      },
      failSideLoad(rewayah: string) {
        state.pendingSide.get(rewayah)?.reject(new Error('disk I/O error'));
        state.pendingSide.delete(rewayah);
      },
      finishMainSwitch(rewayah: string, slots: Record<string, string[]>) {
        state.current = rewayah;
        state.main = toVerses(slots);
        notify();
      },
    },
  };
});

type TestHelpers = {
  state: {current: string; main: Map<string, unknown>};
  listeners: Set<() => void>;
  reset: (current: string, main: Record<string, string[]>) => void;
  finishSideLoad: (rewayah: string, slots: Record<string, string[]>) => void;
  failSideLoad: (rewayah: string) => void;
  finishMainSwitch: (rewayah: string, slots: Record<string, string[]>) => void;
};
const {__test: t, digitalKhattDataService: dk} = jest.requireMock(
  '@/services/mushaf/DigitalKhattDataService',
) as {
  __test: TestHelpers;
  digitalKhattDataService: {ensureRewayahLoaded: jest.Mock};
};

const M1 = '\u06DD\u0661'; // end of verse 1
const M2 = '\u06DD\u0662'; // end of verse 2

// Hafs-shaped slots (every verse ends in its own marker slot).
const HAFS = {
  '1:1': ['H1', 'H2', M1],
  '1:2': ['H3', 'H4', M2],
};
// Rewayah slots in the Release 1 model: a blank Hafs marker slot where the
// rewayah verse continues, an inline marker inside a slot where a rewayah
// verse ends mid Hafs verse, and a multi-token slot.
const REWAYAH = {
  '1:1': ['R1', 'R2', ''],
  '1:2': ['R3 R4', `R5 ${M1}`, 'R6', M2],
};

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useRealTimers();
  t.reset('hafs', HAFS);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('readLoadedVerseTexts', () => {
  it('reads the active rewayah from the main cache', () => {
    expect(isRewayahTextLoaded(['1:1', '1:2'], 'hafs')).toBe(true);
    expect(readLoadedVerseTexts(['1:1', '1:2'], 'hafs')).toEqual([
      `H1 H2 ${M1}`,
      `H3 H4 ${M2}`,
    ]);
  });

  it('returns null, not Hafs, for a rewayah whose words are not loaded', () => {
    expect(isRewayahTextLoaded(['1:1'], 'warsh')).toBe(false);
    expect(readLoadedVerseTexts(['1:1'], 'warsh')).toBeNull();
  });

  it('returns null for a rewayah without bundled text data', () => {
    expect(readLoadedVerseTexts(['1:1'], 'hisham')).toBeNull();
  });

  it('reads a loaded side cache, keeping slot structure from getVerseText', () => {
    t.finishSideLoad('warsh', REWAYAH);
    expect(readLoadedVerseTexts(['1:1', '1:2'], 'warsh')).toEqual([
      'R1 R2',
      `R3 R4 R5 ${M1} R6 ${M2}`,
    ]);
  });
});

describe('waitForRewayahText', () => {
  it('starts a side load for a non-active rewayah and resolves when it lands', async () => {
    const waiting = waitForRewayahText(['1:1'], 'warsh', 5000);
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledWith('warsh');
    t.finishSideLoad('warsh', REWAYAH);
    await expect(waiting).resolves.toBe(true);
    expect(t.listeners.size).toBe(0);
  });

  it('resolves false when the load fails', async () => {
    const waiting = waitForRewayahText(['1:1'], 'warsh', 5000);
    t.failSideLoad('warsh');
    await expect(waiting).resolves.toBe(false);
    expect(t.listeners.size).toBe(0);
  });

  it('resolves false when the load outlasts the timeout', async () => {
    jest.useFakeTimers();
    const waiting = waitForRewayahText(['1:1'], 'warsh', 5000);
    jest.advanceTimersByTime(5000);
    await expect(waiting).resolves.toBe(false);
    expect(t.listeners.size).toBe(0);
  });

  it('waits for the main cache when the rewayah is the active one', async () => {
    // Active rewayah mid-switch: its words are not in memory yet.
    t.reset('warsh', {});
    const waiting = waitForRewayahText(['1:1'], 'warsh', 5000);
    expect(dk.ensureRewayahLoaded).not.toHaveBeenCalled();
    t.finishMainSwitch('warsh', REWAYAH);
    await expect(waiting).resolves.toBe(true);
  });

  it('stops listening when cancelled', () => {
    const onSettled = jest.fn();
    const cancel = watchRewayahText(['1:1'], 'warsh', onSettled, 5000);
    expect(t.listeners.size).toBe(1);
    cancel();
    expect(t.listeners.size).toBe(0);
    t.finishSideLoad('warsh', REWAYAH);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('resolves immediately when the text is already loaded', async () => {
    await expect(waitForRewayahText(['1:1'], 'hafs', 5000)).resolves.toBe(true);
    expect(dk.ensureRewayahLoaded).not.toHaveBeenCalled();
  });
});

describe('resolveVerseTexts', () => {
  it('returns the requested rewayah once its words load', async () => {
    const resolving = resolveVerseTexts(['1:1', '1:2'], 'warsh', 5000);
    t.finishSideLoad('warsh', REWAYAH);
    await expect(resolving).resolves.toEqual({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`],
    });
  });

  it('reports a non-Hafs failure instead of substituting Hafs', async () => {
    const resolving = resolveVerseTexts(['1:1'], 'warsh', 5000);
    t.failSideLoad('warsh');
    await expect(resolving).resolves.toEqual({
      status: 'unavailable',
      rewayah: 'warsh',
    });
  });

  it('falls back to the bundled Hafs text only for a Hafs request', async () => {
    t.reset('warsh', REWAYAH);
    const resolving = resolveVerseTexts(['1:1'], 'hafs', 5000);
    t.failSideLoad('hafs');
    const result = await resolving;
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.rewayah).toBe('hafs');
    expect(result.texts).toEqual([getBundledHafsVerseText('1:1')]);
    expect(result.texts[0].length).toBeGreaterThan(0);
  });
});

describe('getBundledHafsVerseText', () => {
  it('reads the bundled Hafs JSON by verse key', () => {
    const raw = require('@/data/quran.json') as Record<
      string,
      {verse_key: string; text: string}
    >;
    const entry = Object.values(raw).find(v => v.verse_key === '2:255');
    expect(getBundledHafsVerseText('2:255')).toBe(entry?.text);
    expect(getBundledHafsVerseText('999:1')).toBe('');
  });
});

describe('joinVerseTexts', () => {
  it('breaks lines only after a verse number', () => {
    expect(joinVerseTexts([`H1 H2 ${M1}`, `H3 H4 ${M2}`])).toBe(
      `H1 H2 ${M1}\nH3 H4 ${M2}`,
    );
  });

  it('keeps a rewayah verse that spans two Hafs verses on one line', () => {
    expect(joinVerseTexts(['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`])).toBe(
      `R1 R2 R3 R4 R5 ${M1} R6 ${M2}`,
    );
  });

  it('treats the bare digits of the bundled Hafs JSON as a verse end', () => {
    expect(joinVerseTexts(['H1 \u0661', 'H2 \u0662'])).toBe(
      'H1 \u0661\nH2 \u0662',
    );
  });

  it('skips empty verses without leaving stray separators', () => {
    expect(joinVerseTexts(['', `H1 ${M1}`, '', `H2 ${M2}`, ''])).toBe(
      `H1 ${M1}\nH2 ${M2}`,
    );
    expect(joinVerseTexts([])).toBe('');
  });
});

describe('references', () => {
  it('formats single verses and ranges', () => {
    expect(formatVerseRange(['2:255'])).toBe('2:255');
    expect(formatVerseRange(['2:255', '2:256', '2:257'])).toBe('2:255-257');
    expect(formatVerseRange(['2:286', '3:1', '3:2'])).toBe('2:286 - 3:2');
    expect(formatVerseRange([])).toBe('');
  });

  it('labels non-Hafs citations with the rewayah of the text', () => {
    expect(formatQuranCitation('2:255', 'hafs')).toBe('Quran 2:255');
    expect(formatQuranCitation('2:255', 'warsh')).toBe('Quran 2:255 · Warsh');
    expect(formatQuranCitation('Al-Baqarah 2:255', 'qalun')).toBe(
      'Quran Al-Baqarah 2:255 · Qalun',
    );
  });
});

describe('useRewayahVerseTexts', () => {
  type ProbeProps = {verseKeys: string[]; rewayah: string};

  function renderProbe(props: ProbeProps) {
    const results: UseRewayahVerseTextsResult[] = [];
    const Probe = ({verseKeys, rewayah}: ProbeProps) => {
      results.push(
        useRewayahVerseTexts(
          verseKeys,
          rewayah as Parameters<typeof useRewayahVerseTexts>[1],
        ),
      );
      return null;
    };
    // react-test-renderer's typings pin their own React element type.
    type RendererElement = Parameters<typeof TestRenderer.create>[0];
    const element = (p: ProbeProps) =>
      React.createElement(Probe, p) as unknown as RendererElement;
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(element(props));
    });
    return {
      latest: () => results[results.length - 1],
      rerender: (next: ProbeProps) =>
        act(() => {
          renderer?.update(element(next));
        }),
      unmount: () => act(() => renderer?.unmount()),
    };
  }

  const flush = () =>
    act(async () => {
      await Promise.resolve();
    });

  it('is ready at once for the active rewayah', () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'hafs',
      texts: [`H1 H2 ${M1}`],
    });
    probe.unmount();
  });

  it('loads a side rewayah and re-renders when it lands', async () => {
    const probe = renderProbe({verseKeys: ['1:1', '1:2'], rewayah: 'warsh'});
    expect(probe.latest().status).toBe('loading');
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledWith('warsh');

    await act(async () => {
      t.finishSideLoad('warsh', REWAYAH);
    });

    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'warsh',
      texts: ['R1 R2', `R3 R4 R5 ${M1} R6 ${M2}`],
    });
    probe.unmount();
  });

  it('does not restart the load when given a fresh array with the same keys', async () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'warsh'});
    probe.rerender({verseKeys: ['1:1'], rewayah: 'warsh'});
    await flush();
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledTimes(1);
    probe.unmount();
  });

  it('reports a failed non-Hafs load and can retry', async () => {
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'warsh'});
    await act(async () => {
      t.failSideLoad('warsh');
    });
    await flush();
    expect(probe.latest()).toMatchObject({
      status: 'unavailable',
      rewayah: 'warsh',
    });
    expect(probe.latest()).not.toHaveProperty('texts');

    act(() => probe.latest().retry());
    await flush();
    expect(probe.latest().status).toBe('loading');
    expect(dk.ensureRewayahLoaded).toHaveBeenCalledTimes(2);

    await act(async () => {
      t.finishSideLoad('warsh', REWAYAH);
    });
    expect(probe.latest()).toMatchObject({status: 'ready', texts: ['R1 R2']});
    probe.unmount();
  });

  it('serves a failed Hafs load from the bundled Hafs text', async () => {
    t.reset('warsh', REWAYAH);
    const probe = renderProbe({verseKeys: ['1:1'], rewayah: 'hafs'});
    await act(async () => {
      t.failSideLoad('hafs');
    });
    await flush();
    expect(probe.latest()).toMatchObject({
      status: 'ready',
      rewayah: 'hafs',
      texts: [getBundledHafsVerseText('1:1')],
    });
    probe.unmount();
  });
});
