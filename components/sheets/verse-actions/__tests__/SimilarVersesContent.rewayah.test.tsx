// @ai-generated
/**
 * The Similar Verses and Shared Phrases screens of the verse actions sheet
 * show the rewayah the sheet was opened for (a player track's rewayah, or
 * the mushaf's), never the mushaf rewayah's text in another rewayah's sheet:
 * phrase snippets, "Similar wording" previews and expanded matches all come
 * from that rewayah's words, loaded on demand. While they load the screen
 * says so and draws nothing; if they cannot be loaded it says so and offers
 * a retry. A Hafs sheet on a Hafs mushaf shows exactly what it showed
 * before. Fixtures use placeholder words with real verse markers (U+06DD +
 * Arabic-Indic digits) rather than Quran text.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import type {MushafRenderer, RewayahId} from '@/store/mushafSettingsStore';

interface SkiaProps {
  text?: string;
  verseKey?: string;
  rewayah?: string;
  fontFamily: string;
}

const mockSkiaRenders: SkiaProps[] = [];

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({
    __esModule: true,
    default: (props: SkiaProps) => {
      mockSkiaRenders.push(props);
      return null;
    },
  }),
);

jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    ScrollView: (props: {
      children?: React.ReactNode;
      onLayout?: (e: unknown) => void;
    }) =>
      ReactActual.createElement(
        View,
        {onLayout: props.onLayout, testID: 'similar-scroll'},
        props.children,
      ),
    SheetManager: {hideAll: jest.fn()},
  };
});

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/store/mushafNavigationStore', () => ({
  useMushafNavigationStore: {getState: () => ({navigateToVerse: jest.fn()})},
}));

// QUL similar-verse data for the sheet's verse 2:5 (Hafs keys and Hafs word
// positions, like the bundled QUL data).
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    getMutashabihatForVerse: jest.fn(async () => [
      {
        phraseId: 7,
        sourceVerse: '2:5',
        sourceWordRange: [2, 3],
        totalOccurrences: 2,
        matches: [
          {verseKey: '2:5', wordRanges: [[2, 3]]},
          {verseKey: '31:5', wordRanges: [[1, 2]]},
        ],
      },
    ]),
    getSimilarAyahs: jest.fn(async () => [
      {
        matchedVerseKey: '31:5',
        matchedWordsCount: 3,
        coverage: 80,
        score: 75,
        matchWordsRange: [[1, 3]],
      },
    ]),
  },
}));

// The data service's read API with DigitalKhattDataService's load-state
// semantics: the main cache serves `current`; side caches serve other
// rewayat once loaded; a failed load is remembered ('error').
jest.mock('@/services/mushaf/DigitalKhattDataService', () => {
  type MockWord = {
    text: string;
    verseKey: string;
    wordPositionInVerse: number;
  };
  type MockVerses = Map<string, MockWord[]>;
  type MockPending = {resolve: () => void; reject: (err: Error) => void};
  const listeners = new Set<() => void>();
  const state = {
    current: 'hafs',
    version: 0,
    main: new Map() as MockVerses,
    side: new Map<string, MockVerses>(),
    errors: new Set<string>(),
    pendingSide: new Map<string, MockPending>(),
  };
  const notify = () => {
    state.version += 1;
    for (const listener of [...listeners]) listener();
  };
  const service = {
    get rewayah() {
      return state.current;
    },
    isRewayahReady(rewayah: string): boolean {
      return rewayah === state.current || state.side.has(rewayah);
    },
    getRewayahLoadState(rewayah: string): string {
      if (service.isRewayahReady(rewayah)) return 'ready';
      if (state.pendingSide.has(rewayah)) return 'loading';
      if (state.errors.has(rewayah)) return 'error';
      return 'idle';
    },
    // Contract: blank word slots are omitted.
    getVerseWords(verseKey: string, rewayah?: string): MockWord[] {
      const verses =
        !rewayah || rewayah === state.current
          ? state.main
          : state.side.get(rewayah);
      return (verses?.get(verseKey) ?? []).filter(w => w.text !== '');
    },
    getVerseText(verseKey: string, rewayah?: string): string {
      return service
        .getVerseWords(verseKey, rewayah)
        .map(w => w.text)
        .join(' ');
    },
    getPageForVerse: () => 1,
    subscribeCacheChanges: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getCacheVersion: () => state.version,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: jest.fn(
      (rewayah: string) =>
        new Promise<void>((resolve, reject) => {
          if (service.isRewayahReady(rewayah)) {
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
      reset(current: string, main: Record<string, string[]>) {
        state.current = current;
        state.main = toVerses(main);
        state.side.clear();
        state.errors.clear();
        state.pendingSide.clear();
        service.ensureRewayahLoaded.mockClear();
      },
      setSide(rewayah: string, slots: Record<string, string[]>) {
        state.side.set(rewayah, toVerses(slots));
      },
      finishSideLoad(rewayah: string, slots: Record<string, string[]>) {
        state.side.set(rewayah, toVerses(slots));
        state.errors.delete(rewayah);
        notify();
        state.pendingSide.get(rewayah)?.resolve();
        state.pendingSide.delete(rewayah);
      },
      failSideLoad(rewayah: string) {
        state.errors.add(rewayah);
        state.pendingSide.get(rewayah)?.reject(new Error('disk I/O error'));
        state.pendingSide.delete(rewayah);
        notify();
      },
    },
  };
});

import {SimilarVersesContent} from '../SimilarVersesContent';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';

type TestHelpers = {
  reset: (current: string, main: Record<string, string[]>) => void;
  setSide: (rewayah: string, slots: Record<string, string[]>) => void;
  finishSideLoad: (rewayah: string, slots: Record<string, string[]>) => void;
  failSideLoad: (rewayah: string) => void;
};
const {__test: t} = jest.requireMock(
  '@/services/mushaf/DigitalKhattDataService',
) as {__test: TestHelpers};
const ensureRewayahLoaded =
  digitalKhattDataService.ensureRewayahLoaded as jest.Mock;

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const M4 = '۝٤';
const M5 = '۝٥';

// Hafs slots: one word per slot, the verse number in its own slot.
const HAFS = {
  '2:5': ['HAFS-a1', 'HAFS-a2', 'HAFS-a3', 'HAFS-a4', M5],
  '31:5': ['HAFS-b1', 'HAFS-b2', 'HAFS-b3', M5],
};
// The same Hafs slots in Warsh (Release 1 slot model): a multi-token slot, a
// blank slot and the rewayah's own verse number.
const WARSH = {
  '2:5': ['WARSH-a1', 'WARSH-a2 WARSH-a2b', '', 'WARSH-a4', M4],
  '31:5': ['WARSH-b1', 'WARSH-b2', 'WARSH-b3', M4],
};

let renderer: TestRenderer.ReactTestRenderer | null = null;
let warnSpy: jest.SpyInstance;

/** The rendered tree (throws if nothing is rendered). */
function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Opens the screen for verse 2:5 in a sheet for `rewayah`. */
async function render(rewayah: RewayahId, section: 'similar' | 'phrases') {
  await act(async () => {
    renderer = TestRenderer.create(
      <SimilarVersesContent
        verseKey="2:5"
        surahNumber={2}
        ayahNumber={5}
        section={section}
        rewayah={rewayah}
        onDone={() => undefined}
      />,
    );
  });
  // The QUL lookups resolve on the next microtasks.
  await act(async () => {
    await Promise.resolve();
  });
  measure();
}

/** Fire the scroll view's onLayout so the Skia snippets can be drawn. */
function measure() {
  const scroll = root().findAll(
    n => n.props.testID === 'similar-scroll' && typeof n.type === 'string',
  )[0];
  if (!scroll) return;
  act(() => {
    scroll.props.onLayout({nativeEvent: {layout: {width: 320}}});
  });
}

/** The text of every rendered Text element, one string per element. */
function allTexts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n =>
      React.Children.toArray(n.props.children)
        .filter(c => typeof c === 'string' || typeof c === 'number')
        .join(''),
    );
}

/** Text drawn by SkiaVerseText snippets since the last reset. */
const drawnTexts = () =>
  mockSkiaRenders.map(p => p.text).filter((s): s is string => !!s);
const lastSkia = () => mockSkiaRenders[mockSkiaRenders.length - 1];

function press(label: string) {
  const target = root()
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  act(() => {
    target.props.onPress();
  });
}

beforeEach(() => {
  mockSkiaRenders.length = 0;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  warnSpy.mockRestore();
});

describe('a Hafs sheet on a Warsh mushaf (Hafs track in the player)', () => {
  beforeEach(() => {
    useMushafSettingsStore.setState({
      rewayah: 'warsh',
      mushafRenderer: 'dk_v2',
    });
    t.reset('warsh', WARSH);
    t.setSide('hafs', HAFS);
  });

  it('previews similar verses in Hafs, not the mushaf rewayah', async () => {
    await render('hafs', 'similar');
    expect(drawnTexts()).toEqual([`HAFS-b1 HAFS-b2 HAFS-b3 ${M5}`]);
    expect(drawnTexts().join(' ')).not.toContain('WARSH');
  });

  it('draws shared phrases and expanded matches in Hafs', async () => {
    await render('hafs', 'phrases');
    expect(drawnTexts()).toEqual(['HAFS-a2 HAFS-a3']);
    press('31:5');
    // Hafs words, so no Warsh 'Show differences' tints either.
    expect(lastSkia()).toMatchObject({verseKey: '31:5', rewayah: 'hafs'});
    expect(drawnTexts().join(' ')).not.toContain('WARSH');
  });
});

describe('a Warsh sheet on a Hafs mushaf (Warsh track in the player)', () => {
  beforeEach(() => {
    useMushafSettingsStore.setState({
      rewayah: 'hafs',
      mushafRenderer: 'dk_indopak',
    });
    t.reset('hafs', HAFS);
  });

  it('waits for the Warsh words, then shows them in a font that can draw them', async () => {
    await render('warsh', 'similar');
    expect(ensureRewayahLoaded).toHaveBeenCalledWith('warsh');
    // Nothing drawn while loading: never the Hafs text meanwhile.
    expect(drawnTexts()).toEqual([]);
    expect(allTexts()).toContain('Loading the Warsh text');

    await act(async () => {
      t.finishSideLoad('warsh', WARSH);
    });
    measure();
    expect(drawnTexts()).toEqual([`WARSH-b1 WARSH-b2 WARSH-b3 ${M4}`]);
    expect(allTexts()).not.toContain('Loading the Warsh text');
    // IndoPak cannot draw Warsh marks.
    expect(lastSkia().fontFamily).toBe('DigitalKhattV2');
  });

  it('shows Warsh phrases: whole multi-token slots, no blank slots, no verse markers', async () => {
    t.setSide('warsh', WARSH);
    await render('warsh', 'phrases');
    expect(drawnTexts()).toEqual(['WARSH-a2 WARSH-a2b']);
    press('31:5');
    expect(lastSkia()).toMatchObject({verseKey: '31:5', rewayah: 'warsh'});
    expect(drawnTexts().join(' ')).not.toContain('HAFS');
  });

  it('says so when the Warsh words cannot be loaded, and can try again', async () => {
    await render('warsh', 'similar');
    await act(async () => {
      t.failSideLoad('warsh');
    });
    measure();
    expect(allTexts()).toContain("Couldn't load the Warsh text.");
    expect(drawnTexts()).toEqual([]);
    // The references stay listed.
    expect(allTexts().some(s => s.startsWith('31:5'))).toBe(true);

    ensureRewayahLoaded.mockClear();
    press('Try Again');
    expect(ensureRewayahLoaded).toHaveBeenCalledWith('warsh');
    await act(async () => {
      t.finishSideLoad('warsh', WARSH);
    });
    measure();
    expect(drawnTexts()).toEqual([`WARSH-b1 WARSH-b2 WARSH-b3 ${M4}`]);
    expect(allTexts().join(' ')).not.toContain("Couldn't load");
  });
});

describe('a Hafs sheet on a Hafs mushaf: unchanged', () => {
  // The pre-fix snippet and preview code, kept as the reference output.
  function previousPhrase(wordFrom: number, wordTo: number): string {
    const words = digitalKhattDataService.getVerseWords('2:5');
    if (words.length === 0) return '';
    return words
      .filter(
        w =>
          w.wordPositionInVerse >= wordFrom && w.wordPositionInVerse <= wordTo,
      )
      .map(w => w.text)
      .join(' ');
  }
  const previousFont = (mushafRenderer: MushafRenderer) =>
    mushafRenderer === 'dk_indopak'
      ? 'DigitalKhattIndoPak'
      : mushafRenderer === 'dk_v1'
        ? 'DigitalKhattV1'
        : 'DigitalKhattV2';

  beforeEach(() => {
    t.reset('hafs', HAFS);
  });

  it.each<MushafRenderer>(['dk_v1', 'dk_v2', 'dk_indopak', 'qcf_v2'])(
    'shows the same snippets, previews and font (%s)',
    async mushafRenderer => {
      useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer});
      await render('hafs', 'similar');
      expect(drawnTexts()).toEqual([
        digitalKhattDataService.getVerseText('31:5'),
      ]);
      expect(lastSkia().fontFamily).toBe(previousFont(mushafRenderer));
      act(() => renderer?.unmount());
      mockSkiaRenders.length = 0;

      await render('hafs', 'phrases');
      expect(drawnTexts()).toEqual([previousPhrase(2, 3)]);
      expect(lastSkia().fontFamily).toBe(previousFont(mushafRenderer));
      press('31:5');
      const expanded = lastSkia();
      expect(expanded.verseKey).toBe('31:5');
      // Without the prop SkiaVerseText follows the mushaf, Hafs here.
      expect(
        expanded.rewayah ?? useMushafSettingsStore.getState().rewayah,
      ).toBe('hafs');
      // Nothing extra on screen, and no load: the words were in memory.
      expect(allTexts().join(' ')).not.toMatch(/Loading the|Couldn't load/);
      expect(ensureRewayahLoaded).not.toHaveBeenCalled();
    },
  );
});
