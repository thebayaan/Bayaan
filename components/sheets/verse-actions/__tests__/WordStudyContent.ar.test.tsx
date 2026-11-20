// @ai-generated
/**
 * Word Study in the Arabic UI: the tabs, the step bar, the counter and the
 * verse chips in Arabic, every number in Arabic-Indic digits. The app
 * language is fixed when the app starts, so this runs in its own file
 * (as WBWContent.preferences.test.tsx). Real Warsh verse units; the grid
 * and the card are recorders.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {ScrollView, StyleSheet, Text, type TextStyle} from 'react-native';
import i18n from 'i18next';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';

const mockDk = {words: new Map<string, DKWordInfo[]>()};

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('../WordCard', () => ({
  DEFAULT_CARD_SECTIONS: {irab: true, morphology: true, morphologyMore: false},
  WordCard: () => null,
  CompactWordCard: () => null,
}));
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));
jest.mock('react-native-reanimated', () => ({useReducedMotion: () => false}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textSecondary: '#666666', background: '#fff'},
    },
  }),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    isRewayahReady: () => true,
    subscribeCacheChanges: () => () => undefined,
    tryGetVerseWords: (key: string) => mockDk.words.get(key) ?? [],
  },
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {},
}));
jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {
    initialize: async () => undefined,
    getVerseWords: async (key: string) =>
      (mockDk.words.get(key) ?? [])
        .filter(slot => !slot.text.startsWith('۝'))
        .map((slot, i) => ({
          position: i + 1,
          textUthmani: slot.text,
          translation: '',
          transliteration: '',
          audioUrl: '',
        })),
  },
}));
jest.mock('@/services/irab/IrabDataService', () => ({
  irabDataService: {getVerse: async () => [], getBooks: async () => []},
}));
jest.mock('@/services/wordStudy/WordStudyDataService', () => ({
  wordStudyDataService: {
    getVerse: async (verseKey: string) => ({verseKey, gharib: [], rasm: []}),
  },
}));
jest.mock('@/services/mushaf/WordReadingsService', () => ({
  wordReadingsService: {request: async () => null},
}));

import {
  buildRewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {unitSelection} from '@/components/share/rewayahVerseSelection';
import {currentLanguage} from '@/i18n/language';
import {WordStudyContent} from '../WordStudyContent';
import {selectionWordParts} from '../verseUnitScreens'; // @ai

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: {hafs: string[]; warsh: string[]};
  };
fixture.locations.forEach((location, i) => {
  const [s, a, w] = location.split(':');
  const verseKey = `${s}:${a}`;
  const slots = mockDk.words.get(verseKey) ?? [];
  slots.push({
    text: fixture.texts.hafs[i],
    verseKey,
    wordPositionInVerse: Number(w),
  });
  mockDk.words.set(verseKey, slots);
});
const warsh = buildRewayahVerseUnits(
  'warsh',
  fixture.ids.map((id, i): VerseUnitSlot => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  }),
  'warsh@test',
);

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('speaks Arabic, with Arabic-Indic digits in the counter and the chips', async () => {
  expect(currentLanguage).toBe('ar');
  const unit = warsh.unitByKey('103:1');
  if (!unit) throw new Error('no Warsh 103:1');
  act(() => {
    renderer = TestRenderer.create(
      <WordStudyContent
        // @ai
        study={{
          rewayah: 'warsh',
          parts: selectionWordParts(unitSelection(warsh, [unit])),
        }}
      />,
    );
  });
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  if (!renderer) throw new Error('nothing rendered');
  const shown = renderer.root
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
  expect(shown).toEqual(
    expect.arrayContaining([
      'الكلمات',
      'كتب الإعراب',
      'حفص ١٠٣:١',
      'حفص ١٠٣:٢',
      'الكلمة ١ من ٥',
      'السابقة',
      'التالية',
    ]),
  );
  expect(shown.some(text => /[0-9]/.test(text))).toBe(false);
  const labels = renderer.root
    .findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel)
    .map(n => n.props.accessibilityLabel);
  expect(labels).toEqual(
    expect.arrayContaining([
      'الكلمة السابقة',
      'الكلمة التالية',
      'كلمات حفص ١٠٣:١',
    ]),
  );
});

/** The strings drawn in Texts under `node`, in order. */
function textsUnder(node: TestRenderer.ReactTestInstance): string[] {
  return node
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

it('ends with the whole sources notice, with the step bar shown and hidden', async () => {
  const unit = warsh.unitByKey('103:1');
  if (!unit) throw new Error('no Warsh 103:1');
  act(() => {
    renderer = TestRenderer.create(
      <WordStudyContent
        study={{
          rewayah: 'warsh',
          parts: selectionWordParts(unitSelection(warsh, [unit])),
        }}
      />,
    );
  });
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };
  await settle();
  if (!renderer) throw new Error('nothing rendered');
  const screen = renderer.root;
  const scroll = screen.find(n => (n.type as unknown) === ScrollView);
  const scrollEnd = () =>
    StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom;

  // Words tab: the notice is the last thing in the scroll, which keeps space
  // under it, and its lines are tall enough for the Arabic marks (a 17pt
  // line for 12pt text cut them off at the top and bottom).
  const notice = i18n.t('sheets:irab.sources');
  expect(textsUnder(scroll).pop()).toBe(notice);
  expect(scrollEnd()).toBeGreaterThanOrEqual(24);
  const noticeStyle = StyleSheet.flatten(
    screen.find(
      n => (n.type as unknown) === Text && n.props.children === notice,
    ).props.style,
  ) as TextStyle;
  expect(
    (noticeStyle.lineHeight ?? 0) / (noticeStyle.fontSize ?? 1),
  ).toBeGreaterThanOrEqual(1.62);

  // The step bar under the scroll pads its own bottom, above the sheet's.
  const counter = screen.find(
    n => (n.type as unknown) === Text && n.props.children === 'الكلمة ١ من ٥',
  );
  let bar: TestRenderer.ReactTestInstance | null = counter.parent;
  while (
    bar &&
    !(
      typeof bar.type === 'string' &&
      StyleSheet.flatten(bar.props.style)?.borderTopWidth !== undefined
    )
  ) {
    bar = bar.parent;
  }
  if (!bar) throw new Error('no step bar');
  expect(StyleSheet.flatten(bar.props.style).paddingBottom).toBeGreaterThan(0);

  // Books tab: no step bar; the books' notice ends the scroll, with the same
  // space under it.
  const booksTab = screen
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === 'كتب الإعراب').length > 0,
    )
    .pop();
  if (!booksTab) throw new Error('no books tab');
  await act(async () => {
    booksTab.props.onPress();
  });
  await settle();
  expect(textsUnder(screen)).not.toContain('الكلمة ١ من ٥');
  expect(textsUnder(scroll).pop()).toBe(i18n.t('sheets:irab.booksSources'));
  expect(scrollEnd()).toBeGreaterThanOrEqual(24);
});
