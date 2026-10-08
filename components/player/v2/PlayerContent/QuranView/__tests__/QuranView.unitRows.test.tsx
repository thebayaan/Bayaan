// @ai-generated
/**
 * Player verse list (QuranView) of a non-Hafs track (decision 3): the rows
 * are the rewayah's OWN verses (verse units), the follow-along band marks
 * the rewayah verse being recited and the list follows it, a Hafs reference
 * lands on the rewayah verse holding it, and while the verse units are not
 * ready the list shows no rows at all (never Hafs verses under the rewayah's
 * name). Real slots: the verse-units fixture (Warsh al-Fatihah, where Hafs
 * 1:7 is Warsh 1:6 + 1:7 and the basmala is unnumbered, and al-‘Asr, where
 * Warsh 103:1 = Hafs 103:1 + 103:2). Hafs tracks: QuranView.hafsGolden.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

type Props = Record<string, unknown>;
interface RowProps {
  verse: {verse_key: string};
  unitRow?: unknown;
  isActive?: boolean;
  rewayah?: string;
}

const mockRows: RowProps[] = [];
const mockList: {props: Props[]; calls: unknown[][]} = {props: [], calls: []};
const mockBranding: {initialPlayerVerseKey?: (t: unknown) => string} = {};
const mockTrack = {rewayah: 'warsh', surahId: '1'};
const mockUnits: {status: string; ready: boolean} = {
  status: 'ready',
  ready: true,
};

jest.mock('../VerseItem', () => ({
  VerseItem: (props: RowProps) => {
    mockRows.push(props);
    return null;
  },
}));

jest.mock('../BasmalaHeader', () => ({__esModule: true, default: () => null}));

jest.mock('../SurahDivider', () => ({
  __esModule: true,
  default: () => null,
  computeDividerTotalHeight: () => 0,
}));

jest.mock('@shopify/flash-list', () => {
  const ReactActual = jest.requireActual('react');
  const FlashList = ReactActual.forwardRef(
    (
      props: {
        data: unknown[];
        renderItem: (info: {item: unknown; index: number}) => unknown;
        keyExtractor: (item: unknown) => string;
        ListHeaderComponent?: unknown;
      },
      ref: unknown,
    ) => {
      ReactActual.useImperativeHandle(ref, () => ({
        scrollToIndex: (args: unknown) =>
          mockList.calls.push(['scrollToIndex', args]),
        scrollToOffset: (args: unknown) =>
          mockList.calls.push(['scrollToOffset', args]),
      }));
      mockList.props.push({
        ...props,
        keys: props.data.map(props.keyExtractor),
      });
      return ReactActual.createElement(
        ReactActual.Fragment,
        null,
        props.ListHeaderComponent,
        props.data.map((item: unknown, index: number) =>
          ReactActual.createElement(
            ReactActual.Fragment,
            {key: index},
            props.renderItem({item, index}),
          ),
        ),
      );
    },
  );
  return {FlashList};
});

jest.mock('@gorhom/bottom-sheet', () => ({
  useBottomSheetScrollableCreator: () => undefined,
}));

jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', border: '#cccccc', card: '#ffffff'},
    },
    isDarkMode: false,
  }),
}));

jest.mock('@/hooks/useReadingThemeColors', () => ({
  useReadingThemeColors: () => ({
    text: '#111111',
    textSecondary: '#666666',
    background: '#ffffff',
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({isTablet: false}),
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@/hooks/useCurrentTrackRewayah', () => ({
  useCurrentTrackRewayah: () => mockTrack.rewayah,
}));

jest.mock('@/hooks/useRewayahVerseUnits', () => {
  const {fixtureUnits} = jest.requireActual(
    '../__fixtures__/verseUnitsFixtures',
  );
  return {
    useRewayahVerseUnits: (rewayah: string | null) => {
      if (!rewayah) return {units: null, status: 'unavailable'};
      if (!mockUnits.ready) return {units: null, status: mockUnits.status};
      const db = rewayah === 'warsh' ? 'warsh' : 'bazzi';
      return {units: fixtureUnits(db), status: 'ready'};
    },
  };
});

jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));

jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: true},
}));

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      loadAnnotationsForSurah: () => undefined,
    })),
  };
});

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/services/player/store/playerStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    usePlayerStore: create(() => ({
      queue: {tracks: [{id: 'track-1', surahId: '1'}], currentIndex: 0},
    })),
  };
});

jest.mock('@/services/timestamps/TimestampService', () => ({
  timestampService: {getTimestampsForSurah: async () => null},
}));

jest.mock('@/utils/translationLookup', () => ({
  getTranslationName: () => 'Translation',
}));

jest.mock('@/config/branding', () => ({
  __esModule: true,
  get default() {
    return mockBranding;
  },
}));

// @ai — the release's timestampStore imports the timing fetcher, which reads
// branding at import time (before mockBranding is initialised).
jest.mock('@/services/timestamps/TimestampFetchService', () => ({
  timestampFetchService: {hasSurah: () => true, hasSource: () => true},
}));

// Placeholder Hafs verses with a translation per Hafs key; a rebuild (new
// translation) changes the suffix.
jest.mock('@/utils/enhancedVerseData', () => {
  const counts: Record<number, number> = {1: 7, 103: 3};
  const enhancedVersesBySurah: Record<number, unknown[]> = {};
  let suffix = '';
  const build = () => {
    for (const [surah, count] of Object.entries(counts)) {
      enhancedVersesBySurah[Number(surah)] = Array.from(
        {length: count},
        (_, i) => ({
          id: i + 1,
          verse_key: `${surah}:${i + 1}`,
          surah_number: Number(surah),
          ayah_number: i + 1,
          text: `HAFS-TEXT-${surah}:${i + 1}`,
          translation: `T(${surah}:${i + 1})${suffix}`,
          transliteration: `TL(${surah}:${i + 1})`,
        }),
      );
    }
  };
  build();
  return {
    enhancedVersesBySurah,
    rebuildEnhancedVerses: async (id: string) => {
      if (id !== 'other') return false;
      suffix = '-other';
      build();
      return true;
    },
    resetTranslations: () => {
      suffix = '';
      build();
    },
  };
});

import {QuranView} from '../index';
import type {VerseUnitRow} from '../verseUnitRows';
import {useTimestampStore} from '@/store/timestampStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  registerTimingNumbering,
  type TimingNumbering,
} from '@/utils/timestampNumbering';
import type {AyahTimestamp} from '@/types/timestamps';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

// The list defers its anchor scroll by two animation frames.
jest.useFakeTimers();

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(surah = 1) {
  act(() => {
    renderer = TestRenderer.create(
      <QuranView
        currentSurah={surah}
        onVersePress={() => undefined}
        showTranslation
        transliterationFontSize={14}
        translationFontSize={15}
        arabicFontSize={24}
      />,
    );
  });
  act(() => {
    jest.runAllTimers();
  });
  return renderer!;
}

/** Props of the latest render of each row, in list order. */
function rows(): Map<string, RowProps> {
  const latest = new Map<string, RowProps>();
  for (const p of mockRows) latest.set(p.verse.verse_key, p);
  return latest;
}

const active = () =>
  [...rows().values()].filter(p => p.isActive).map(p => p.verse.verse_key);

const scrolls = () =>
  mockList.calls
    .filter(c => c[0] === 'scrollToIndex')
    .map(c => (c[1] as {index: number}).index);

function numbering(
  mode: 'hafs' | 'riwayah',
  reciterRewayah: TimingNumbering['reciterRewayah'],
): TimingNumbering {
  return {
    surah: 1,
    mode,
    reciterRewayah,
    reason: 'test',
    hafsKeysForEntry: () => [],
    entryAyahsForHafsAyah: () => [],
    startEntryForHafsAyah: () => null,
    endEntryAyahForHafsAyah: () => null,
    entryRangeForHafsAyah: () => null,
    // Verse-unit answers of fix/r1-v-audio (unused here). @ai
    numbersVersesOf: rewayah =>
      mode === 'riwayah' && reciterRewayah === rewayah,
    startEntryForUnit: () => null,
    endEntryAyahForUnit: () => null,
    entryRangeForUnit: () => null,
    unitKeysForEntry: () => [],
  };
}

/** A timing set of the track, registered with `n` like useAyahTracker. */
function timings(n?: TimingNumbering): AyahTimestamp[] {
  const entries = [] as unknown as AyahTimestamp[];
  if (n) registerTimingNumbering(entries, n);
  act(() => {
    useTimestampStore.setState({currentSurahTimestamps: entries});
  });
  return entries;
}

/** What useAyahTracker publishes for one timing entry. */
function recite(hafsKeys: string[], reciterVerseKey: string) {
  const [surah, ayah] = hafsKeys[0].split(':').map(Number);
  act(() => {
    useTimestampStore.setState({
      currentAyah: {
        surahNumber: surah,
        ayahNumber: ayah,
        verseKey: hafsKeys[0],
        timestampFrom: 0,
        timestampTo: 1000,
        verseKeys: hafsKeys,
        reciterVerseKey,
      } as never,
    });
  });
}

beforeEach(() => {
  (
    jest.requireMock('@/utils/enhancedVerseData') as {
      resetTranslations: () => void;
    }
  ).resetTranslations();
  mockRows.length = 0;
  mockList.props.length = 0;
  mockList.calls.length = 0;
  delete mockBranding.initialPlayerVerseKey;
  mockTrack.rewayah = 'warsh';
  mockUnits.ready = true;
  mockUnits.status = 'ready';
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v2',
    rewayah: 'hafs',
    selectedTranslationId: 'saheeh',
  });
  useTimestampStore.setState({
    currentAyah: null,
    currentSurahTimestamps: null,
    isLocked: true,
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('rows are the rewayah verses', () => {
  it('Warsh al-Fatihah: the unnumbered basmala, then Warsh 1:1..1:7', () => {
    render();
    const keys = ['basmala', '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'];
    expect([...rows().keys()]).toEqual(keys);
    expect(mockList.props[mockList.props.length - 1].keys).toEqual(keys);
    for (const p of rows().values()) {
      // The row itself is the VerseItem's verse and its unit row.
      expect(p.unitRow).toBe(p.verse);
      expect(p.rewayah).toBe('warsh');
    }
  });

  it('rows carry the Hafs translation of every Hafs verse they hold', () => {
    render();
    const unitRow = (key: string) => rows().get(key)!.unitRow as VerseUnitRow;
    expect(
      unitRow('1:6').parts.map(p => [p.hafsKey, p.owned, p.translation]),
    ).toEqual([['1:7', true, 'T(1:7)']]);
    expect(
      unitRow('1:7').parts.map(p => [p.hafsKey, p.owned, p.translation]),
    ).toEqual([['1:7', false, 'T(1:7)']]);
    expect(unitRow('basmala').parts.map(p => p.translation)).toEqual([
      'T(1:1)',
    ]);
  });

  it('a new translation reaches the rows', async () => {
    render();
    await act(async () => {
      useMushafSettingsStore.setState({selectedTranslationId: 'other'});
    });
    const v1 = rows().get('1:1')!.unitRow as VerseUnitRow;
    expect(v1.parts[0].translation).toBe('T(1:2)-other');
  });

  it('al-Bazzi al-Fatihah numbers the basmala: no unnumbered row', () => {
    mockTrack.rewayah = 'al-bazzi';
    render();
    expect([...rows().keys()][0]).toBe('1:1');
    expect(rows().size).toBe(7);
  });
});

describe('follow-along marks the rewayah verse being recited', () => {
  it('a Warsh-numbered timing set: exactly Warsh 1:6, then 1:7', () => {
    render();
    timings(numbering('riwayah', 'warsh'));
    recite(['1:7'], '1:6');
    expect(active()).toEqual(['1:6']);
    recite(['1:7'], '1:7');
    expect(active()).toEqual(['1:7']);
    // The list follows the active verse (index 6 = Warsh 1:6).
    expect(scrolls()).toEqual([6, 7]);
  });

  it('a Hafs-numbered timing set: both Warsh verses of Hafs 1:7', () => {
    render();
    timings(numbering('hafs', 'warsh'));
    recite(['1:7'], '1:7');
    expect(active()).toEqual(['1:6', '1:7']);
    expect(scrolls()).toEqual([6]);
  });

  it('the unnumbered basmala lights nothing and scrolls nowhere', () => {
    render();
    timings(numbering('hafs', 'warsh'));
    recite(['1:1'], '1:1');
    expect(active()).toEqual([]);
    expect(scrolls()).toEqual([]);
  });

  it('a merged verse (Warsh 103:1 = Hafs 103:1 + 103:2) is one row', () => {
    render(103);
    expect([...rows().keys()]).toEqual(['103:1', '103:2', '103:3']);
    timings();
    recite(['103:2'], '103:2');
    expect(active()).toEqual(['103:1']);
  });

  it('nothing is marked while the list is unlocked; recentring returns to it', () => {
    const r = render();
    timings(numbering('riwayah', 'warsh'));
    recite(['1:7'], '1:7');
    mockList.calls.length = 0;
    act(() => useTimestampStore.setState({isLocked: false}));
    expect(active()).toEqual([]);
    const recenter = r.root.findAll(
      n =>
        typeof n.type !== 'string' &&
        typeof n.props.onPress === 'function' &&
        n.props.style !== undefined,
    );
    act(() => recenter[recenter.length - 1].props.onPress());
    expect(useTimestampStore.getState().isLocked).toBe(true);
    // The button and the re-locked follow-along both go to Warsh 1:7 (as for
    // a Hafs track).
    expect(scrolls().length).toBeGreaterThan(0);
    expect(new Set(scrolls())).toEqual(new Set([7]));
    expect(active()).toEqual(['1:7']);
  });
});

describe('a Hafs reference (fork anchor) lands on the rewayah verse holding it', () => {
  it('Hafs 1:7 opens at Warsh 1:6', () => {
    mockBranding.initialPlayerVerseKey = () => '1:7';
    render();
    expect(mockList.props[mockList.props.length - 1].initialScrollIndex).toBe(
      6,
    );
    expect(scrolls()).toEqual([6]);
  });

  it('the unnumbered basmala is no verse: the top of the surah', () => {
    mockBranding.initialPlayerVerseKey = () => '1:1';
    render();
    expect(
      mockList.props[mockList.props.length - 1].initialScrollIndex,
    ).toBeUndefined();
  });
});

describe('until the verse units are ready: no rows, never Hafs rows', () => {
  it('loading: a spinner', () => {
    mockUnits.ready = false;
    mockUnits.status = 'loading';
    const r = render();
    expect(mockRows).toEqual([]);
    expect(mockList.props).toEqual([]);
    const pending = r.root.findAll(
      n => n.props.testID === 'verse-units-pending',
    );
    expect(pending.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.toJSON())).not.toContain('verses.');
  });

  it('refused or unavailable: a short message', () => {
    mockUnits.ready = false;
    mockUnits.status = 'error';
    const r = render();
    expect(mockRows).toEqual([]);
    expect(JSON.stringify(r.toJSON())).toContain(
      "Couldn't load the Warsh verses.",
    );
  });

  it('the rows appear, locked on the reciter, once the units are ready', () => {
    mockUnits.ready = false;
    mockUnits.status = 'loading';
    act(() => useTimestampStore.setState({isLocked: false}));
    const r = render();
    expect(mockRows).toEqual([]);
    mockUnits.ready = true;
    act(() => {
      r.update(
        <QuranView
          currentSurah={1}
          onVersePress={() => undefined}
          showTranslation
          transliterationFontSize={14}
          translationFontSize={15}
          arabicFontSize={24}
        />,
      );
    });
    expect(rows().size).toBe(8);
    expect(useTimestampStore.getState().isLocked).toBe(true);
  });
});
