// @ai-generated
/**
 * The verse actions sheet's Hafs-aligned screens, rendered for a verse of
 * another rewayah in its own numbering (decision 3; verse-units contract
 * 4.3, 4.6): the translation and tafsir pagers page through the rewayah's
 * verses and show every Hafs verse holding the verse (a divided Hafs verse
 * whole, with a note); word by word shows one view per Hafs verse, captioned;
 * the theme is the theme of the verse's first Hafs verse, its passage told
 * in the rewayah's numbering; similar-verse results keep their Hafs
 * references, prefixed "Hafs". The pure page builders are checked by
 * verseUnitScreens.test.ts; this checks each screen uses them.
 *
 * Real Warsh slots (verseUnitsFixture.json: Warsh 1:5 = Hafs 1:6, 1:6 = Hafs
 * 1:7 words 1-4, 1:7 = the rest of Hafs 1:7, 103:1 = Hafs 103:1 + 103:2);
 * translations, tafsir and themes are placeholders keyed by Hafs verse.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

const mockLog: Array<[string, Record<string, unknown>]> = [];
function mockRecord(name: string, props: Record<string, unknown>) {
  mockLog.push([name, props]);
  return null;
}
jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockRecord('preview', props),
}));
jest.mock('../TafseerHtmlRenderer', () => ({
  TafseerHtmlRenderer: (props: Record<string, unknown>) =>
    mockRecord('tafsir', props),
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({
    WBWVerseView: (props: Record<string, unknown>) => mockRecord('wbw', props),
  }),
);
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => mockRecord('skia', props),
  }),
);
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({StackedVolumesIcon: () => null}));
jest.mock('expo-router', () => ({router: {push: jest.fn()}}));
jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({setSheetMode: jest.fn()})},
}));
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
        {onLayout: props.onLayout},
        props.children,
      ),
    SheetManager: {hideAll: jest.fn(), hide: jest.fn()},
  };
});
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
jest.mock('@/utils/translationLookup', () => ({
  getTranslationText: (key: string, id: string) => `<b>T</b>(${key},${id})`,
  getTranslationTextRaw: (key: string, id: string) => `T(${key},${id})`,
  getTranslationName: (id: string) => `Name-${id}`,
  isBundledTranslation: () => true,
}));
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {getTranslation: jest.fn(async () => null)},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: new Proxy({}, {get: () => () => undefined}),
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({
  tafseerDbService: {
    getTafseerForVerse: jest.fn(async (key: string, id: string) => {
      const [s, a] = key.split(':').map(Number);
      return {surahNumber: s, fromAyah: a, toAyah: a, text: `${id}@${key}`};
    }),
  },
}));
jest.mock('@/services/mushaf/ThemeDataService', () => ({
  themeDataService: {
    // One theme per Hafs verse of surah 103, over Hafs 103:1-2.
    getThemeForVerse: (key: string) =>
      key.startsWith('103:')
        ? {theme: `THEME of ${key}`, surah: 103, ayahFrom: 1, ayahTo: 2}
        : null,
  },
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true, quranCommonTypeface: null},
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));
jest.mock('@/store/mushafNavigationStore', () => ({
  useMushafNavigationStore: {getState: () => ({navigateToVerse: jest.fn()})},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    rewayah: 'hafs',
    initialized: true,
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    getVerseText: (key: string) => `TEXT-${key}`,
    getVerseWords: () => [],
    getPageForVerse: () => 1,
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    retainRewayah: () => () => undefined,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null, status: () => 'error'}),
}));
jest.mock('@/services/mushaf/QulDataService', () => ({
  qulDataService: {
    getMutashabihatForVerse: jest.fn(async (key: string) => [
      {
        phraseId: 1,
        sourceVerse: key,
        sourceWordRange: [1, 2],
        totalOccurrences: 2,
        matches: [
          {verseKey: key, wordRanges: [[1, 2]]},
          {verseKey: '2:255', wordRanges: [[1, 2]]},
        ],
      },
    ]),
    getSimilarAyahs: jest.fn(async () => [
      {
        matchedVerseKey: '3:2',
        score: 80,
        coverage: 50,
        matchedWordsCount: 3,
        matchWordsRange: [[1, 3]],
      },
    ]),
  },
}));
jest.mock('@/components/sheets/similarVersePhrase', () => ({
  getSimilarPhraseText: () => 'PHRASE',
}));

import {TranslationContent} from '../TranslationContent';
import {TafseerContent} from '../TafseerContent';
import {WBWContent} from '../WBWContent';
import {ThemeContent} from '../ThemeContent';
import {SimilarVersesContent} from '../SimilarVersesContent';
import {tafseerDbService} from '@/services/tafseer/TafseerDbService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTafseerStore} from '@/store/tafseerStore';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {UnitStart} from '../verseUnitScreens';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<'warsh', string[]>;
  };
function buildWarsh(): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  });
  return buildRewayahVerseUnits('warsh', slots, 'warsh@test');
}
const warsh = buildWarsh();
const start = (key: string): UnitStart => ({
  model: warsh,
  unit: warsh.unitByKey(key)!,
});
const unitText = (key: string) => warsh.unitText(warsh.unitByKey(key)!);
const NOTE_17 =
  'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';
const TAFSIR_NOTE_17 =
  'Tafsir of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';

let renderer: TestRenderer.ReactTestRenderer | null = null;

async function settle() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function render(element: Parameters<typeof TestRenderer.create>[0]) {
  mockLog.length = 0;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  await settle();
}

/** Every string drawn in a Text. */
function texts(): string[] {
  return renderer!.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n =>
      ([] as unknown[])
        .concat(n.props.children)
        .filter(c => typeof c === 'string' || typeof c === 'number')
        .join(''),
    )
    .filter(Boolean);
}

async function press(label: string) {
  const target = renderer!.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${label}`);
  await act(async () => {
    await target.props.onPress();
  });
  await settle();
}

const logged = (name: string) =>
  mockLog.filter(([n]) => n === name).map(([, props]) => props);
const lastLogged = (name: string) => logged(name).pop();

beforeEach(() => {
  jest.clearAllMocks();
  useMushafSettingsStore.setState({
    rewayah: 'warsh',
    mushafRenderer: 'dk_v2',
    selectedTranslationId: 'saheeh',
  });
  useTafseerStore.setState({
    selectedTafseerId: 'tf-1',
    downloadedMeta: [
      {
        identifier: 'tf-1',
        name: 'Tafsir One',
        englishName: 'Tafsir One',
        direction: 'ltr',
      },
    ],
  } as never);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('translation pager', () => {
  it("shows the verse's Hafs verse whole, with a note, and pages Warsh verses", async () => {
    // The sheet passes the Hafs fields of Warsh 1:6's anchor (Hafs 1:7).
    await render(
      <TranslationContent
        surahNumber={1}
        ayahNumber={7}
        rewayah="warsh"
        unitStart={start('1:6')}
        onBack={() => undefined}
      />,
    );
    expect(texts()).toEqual(
      expect.arrayContaining(['1:6', 'T(1:7,saheeh)', NOTE_17]),
    );
    expect(lastLogged('preview')).toMatchObject({
      text: unitText('1:6'),
      rewayah: 'warsh',
    });

    await press('Prev');
    // Warsh 1:5 is Hafs 1:6: no note.
    expect(texts()).toEqual(expect.arrayContaining(['1:5', 'T(1:6,saheeh)']));
    expect(texts()).not.toContain(NOTE_17);

    await press('Next');
    await press('Next');
    expect(texts()).toEqual(
      expect.arrayContaining(['1:7', 'T(1:7,saheeh)', NOTE_17]),
    );
    expect(lastLogged('preview')).toMatchObject({text: unitText('1:7')});
  });

  it('a verse holding two Hafs verses shows both translations', async () => {
    await render(
      <TranslationContent
        surahNumber={103}
        ayahNumber={1}
        rewayah="warsh"
        unitStart={start('103:1')}
        onBack={() => undefined}
      />,
    );
    expect(texts()).toEqual(
      expect.arrayContaining(['103:1', 'T(103:1,saheeh)\nT(103:2,saheeh)']),
    );
  });

  it('Hafs: pages the Hafs verses, as before', async () => {
    await render(
      <TranslationContent
        surahNumber={1}
        ayahNumber={7}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
    expect(texts()).toEqual(expect.arrayContaining(['1:7', 'T(1:7,saheeh)']));
    expect(lastLogged('preview')).toMatchObject({verseKey: '1:7'});
    expect(lastLogged('preview')?.text).toBeUndefined();
  });
});

describe('tafsir pager', () => {
  it("reads the verse's Hafs verse, notes it, and pages Warsh verses", async () => {
    await render(
      <TafseerContent
        surahNumber={1}
        ayahNumber={7}
        rewayah="warsh"
        unitStart={start('1:6')}
        onBack={() => undefined}
      />,
    );
    expect(tafseerDbService.getTafseerForVerse).toHaveBeenCalledWith(
      '1:7',
      'tf-1',
    );
    expect(lastLogged('tafsir')).toMatchObject({html: 'tf-1@1:7'});
    // The passage is Hafs 1:7, not the page's own verse: labelled as Hafs.
    expect(texts()).toEqual(
      expect.arrayContaining(['1:6', 'HAFS 1:7', TAFSIR_NOTE_17]),
    );

    await press('Prev');
    expect(lastLogged('tafsir')).toMatchObject({html: 'tf-1@1:6'});
    expect(texts()).toContain('1:5');
    expect(texts()).not.toContain(TAFSIR_NOTE_17);
  });

  it('a verse holding two Hafs verses shows both passages', async () => {
    await render(
      <TafseerContent
        surahNumber={103}
        ayahNumber={1}
        rewayah="warsh"
        unitStart={start('103:1')}
        onBack={() => undefined}
      />,
    );
    expect(logged('tafsir').map(p => p.html)).toEqual(
      expect.arrayContaining(['tf-1@103:1', 'tf-1@103:2']),
    );
    expect(texts()).toEqual(
      expect.arrayContaining(['103:1', 'HAFS 103:1', 'HAFS 103:2']),
    );
  });
});

describe('word by word', () => {
  it('one view per Hafs verse of the verse, captioned', async () => {
    await render(
      <WBWContent
        surahNumber={103}
        ayahNumber={1}
        rewayah="warsh"
        unitStart={start('103:1')}
        onBack={() => undefined}
      />,
    );
    expect(logged('wbw').map(p => p.verseKey)).toEqual(['103:1', '103:2']);
    expect(texts()).toEqual(
      expect.arrayContaining(['Hafs 103:1', 'Hafs 103:2']),
    );
  });

  it('Hafs: the verse itself, uncaptioned', async () => {
    await render(
      <WBWContent
        surahNumber={103}
        ayahNumber={1}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
    expect(logged('wbw').map(p => p.verseKey)).toEqual(['103:1']);
    expect(texts().some(t => t.startsWith('Hafs'))).toBe(false);
  });
});

describe('theme', () => {
  it("the theme of the verse's first Hafs verse, its passage in Warsh verses", async () => {
    // A Hafs-keyed payload of Hafs 103:2 selects Warsh 103:1 (Hafs 103:1 +
    // 103:2): the theme is read from Hafs 103:1, the passage (Hafs 103:1-2)
    // is that one Warsh verse.
    await render(
      <ThemeContent
        surahNumber={103}
        ayahNumber={2}
        unitStart={start('103:1')}
        onBack={() => undefined}
      />,
    );
    expect(texts()).toEqual(
      expect.arrayContaining(['THEME of 103:1', '103:1 – 103:1', '1']),
    );
  });

  it('Hafs: the payload verse and its Hafs passage, as before', async () => {
    await render(
      <ThemeContent
        surahNumber={103}
        ayahNumber={2}
        onBack={() => undefined}
      />,
    );
    expect(texts()).toEqual(
      expect.arrayContaining(['THEME of 103:2', '103:1 – 103:2', '2']),
    );
  });
});

describe('similar verses', () => {
  // The release's screen also takes the sheet's rewayah.
  const props = (hafsReferences: boolean) =>
    ({
      verseKey: '1:6',
      surahNumber: 1,
      ayahNumber: 6,
      section: 'similar',
      onDone: () => undefined,
      hafsReferences,
      rewayah: hafsReferences ? 'warsh' : 'hafs',
    }) as unknown as React.ComponentProps<typeof SimilarVersesContent>;

  it('another rewayah: results keep their Hafs references, prefixed', async () => {
    await render(<SimilarVersesContent {...props(true)} />);
    expect(texts()).toContain("Hafs 3:2 · Ali 'Imran");
    await render(<SimilarVersesContent {...props(true)} section="phrases" />);
    expect(texts()).toContain('Hafs 2:255');
  });

  it('Hafs: plain references, as before', async () => {
    await render(<SimilarVersesContent {...props(false)} />);
    expect(texts()).toContain("3:2 · Ali 'Imran");
    await render(<SimilarVersesContent {...props(false)} section="phrases" />);
    expect(texts()).toContain('2:255');
  });
});
