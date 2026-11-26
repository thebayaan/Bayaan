/**
 * The Translation and Tafsir pages of the verse sheet, in English: the
 * Previous / Next row under the page has 44pt buttons with their content
 * centered and space of its own above and below them (the sheet's bottom
 * padding and safe-area inset come under it), and the translation names stay
 * as before: the bundled names, set in capitals. The page scrolls in the
 * sheet's list and the row is a sheet footer, so the sheet never drags from
 * it (sheetGestures.tsx).
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {ScrollView, StyleSheet, Text, type ViewStyle} from 'react-native';

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../TafseerHtmlRenderer', () => ({TafseerHtmlRenderer: () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/components/Icons', () => ({StackedVolumesIcon: () => null}));
jest.mock('expo-router', () => ({router: {push: jest.fn()}}));
jest.mock('@/utils/haptics', () => ({lightHaptics: jest.fn()}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {getState: () => ({setSheetMode: jest.fn()})},
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {hideAll: jest.fn(), hide: jest.fn()},
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        textTertiary: '#888888',
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
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

import {TranslationContent} from '../TranslationContent';
import {TafseerContent} from '../TafseerContent';
import {SheetFooter, SheetScrollView} from '../sheetGestures';
import {verticalScale} from '@/utils/scale';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTafseerStore} from '@/store/tafseerStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

async function render(element: Parameters<typeof TestRenderer.create>[0]) {
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** The Text drawing exactly this string. */
function textNode(label: string): TestRenderer.ReactTestInstance {
  return root().find(
    n => (n.type as unknown) === Text && n.props.children === label,
  );
}

/** The flattened style of the nearest host view around `node` that `has`. */
function hostStyleAround(
  node: TestRenderer.ReactTestInstance,
  has: keyof ViewStyle,
): ViewStyle {
  let current: TestRenderer.ReactTestInstance | null = node.parent;
  while (current) {
    if (typeof current.type === 'string') {
      const style = StyleSheet.flatten(current.props.style) as ViewStyle;
      if (style && style[has] !== undefined) return style;
    }
    current = current.parent;
  }
  throw new Error(`no view with ${String(has)}`);
}

/** The footer's buttons and the footer row itself. */
function footer(previous: string, next: string) {
  const prev = textNode(previous);
  return {
    previous: hostStyleAround(prev, 'minHeight'),
    next: hostStyleAround(textNode(next), 'minHeight'),
    row: hostStyleAround(prev, 'borderTopWidth'),
  };
}

function expectComfortableFooter(row: ReturnType<typeof footer>) {
  for (const button of [row.previous, row.next]) {
    // The 44pt tap target, content centered in it.
    expect(button.minHeight).toBeGreaterThanOrEqual(44);
    expect(button.alignItems).toBe('center');
    expect(button.justifyContent).toBe('center');
  }
  // Space of its own above and below the buttons.
  expect(row.row.paddingTop).toBeGreaterThan(0);
  expect(row.row.paddingBottom).toBeGreaterThan(0);
}

beforeEach(() => {
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    selectedTranslationId: 'saheeh',
  });
  useTafseerStore.setState({
    selectedTafseerId: 'tf-1',
    downloadedMeta: [
      {
        identifier: 'tf-1',
        name: 'Tafsir One',
        englishName: 'Tafsir One',
        language: 'english',
        direction: 'ltr',
      },
    ],
  } as never);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('the Previous / Next row', () => {
  it('Translation: 44pt buttons with space above and below', async () => {
    await render(
      <TranslationContent
        surahNumber={1}
        ayahNumber={7}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
    expectComfortableFooter(footer('Prev', 'Next'));
  });

  it('Tafsir: 44pt buttons with space above and below', async () => {
    await render(
      <TafseerContent
        surahNumber={1}
        ayahNumber={7}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
    expectComfortableFooter(footer('Prev', 'Next'));
  });
});

describe('translation names in English', () => {
  it('shows the bundled names in capitals, as before', async () => {
    await render(
      <TranslationContent
        surahNumber={1}
        ayahNumber={1}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
    for (const name of ['Saheeh International', 'The Clear Quran']) {
      const style = StyleSheet.flatten(textNode(name).props.style);
      expect(style.textTransform).toBe('uppercase');
    }
  });
});

describe('in the sheet', () => {
  const pages = [
    ['Translation', TranslationContent],
    ['Tafsir', TafseerContent],
  ] as const;

  it.each(pages)(
    '%s: scrolls in the sheet list; Previous / Next is a sheet footer',
    async (_name, Page) => {
      await render(
        <Page
          surahNumber={1}
          ayahNumber={7}
          rewayah="hafs"
          onBack={() => undefined}
        />,
      );
      // One list, the sheet's: no scroll view of its own that the sheet
      // could not tell from a drag.
      const lists = root().findAllByType(SheetScrollView);
      expect(lists).toHaveLength(1);
      const scrollViews = root().findAll(
        n => (n.type as unknown) === ScrollView,
      );
      expect(scrollViews.length).toBeGreaterThan(0);
      for (const scroll of scrollViews) {
        expect(scroll.parent?.type).toBe(SheetScrollView);
      }
      // The row with Previous and Next is the footer, spaced as the Word
      // Study step bar is.
      const footerRow = root().findByType(SheetFooter);
      for (const label of ['Prev', 'Next']) {
        expect(
          footerRow.findAll(
            n => (n.type as unknown) === Text && n.props.children === label,
          ),
        ).toHaveLength(1);
      }
      const style = StyleSheet.flatten(footerRow.props.style) as ViewStyle;
      expect(style.paddingTop).toBe(verticalScale(12));
      expect(style.paddingBottom).toBe(verticalScale(18));
    },
  );
});
