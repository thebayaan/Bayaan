/**
 * The Translation page in the Arabic UI: the bundled translations go by their
 * Arabic names, which say they are English translations; a downloaded
 * translation keeps the name its catalogue gives it; nothing is set in
 * capitals. The Previous / Next row keeps its 44pt buttons. The app language
 * is fixed when the app starts, so this runs in its own file.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text, type ViewStyle} from 'react-native';
import i18n from 'i18next';

// The sheet's lists and footers as plain views: no sheet here.
jest.mock('../sheetGestures');
jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
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
  translationDbService: {
    getTranslation: jest.fn(async (key: string, id: string) => `${id}@${key}`),
  },
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: new Proxy({}, {get: () => () => undefined}),
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

import {currentLanguage} from '@/i18n/language';
import {TranslationContent} from '../TranslationContent';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import {registerRemoteTranslationName} from '@/utils/translationLookup';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const SAHEEH_AR = 'صحيح إنترناشونال (بالإنجليزية)';
const CLEAR_QURAN_AR = 'القرآن الواضح (بالإنجليزية)';

let renderer: TestRenderer.ReactTestRenderer | null = null;

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every string drawn in a Text. */
function texts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

/** The Text drawing exactly this string. */
function textNode(label: string): TestRenderer.ReactTestInstance {
  return root().find(
    n => (n.type as unknown) === Text && n.props.children === label,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});

beforeEach(() => {
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    selectedTranslationId: 'saheeh',
  });
  useTranslationStore.setState({
    downloadedMeta: [
      {
        identifier: 'ur.jalandhry',
        name: 'جالندہری',
        englishName: 'Jalandhry',
        language: 'ur',
        direction: 'rtl',
        downloadedAt: 0,
        verseCount: 6236,
      },
    ],
  });
  // The store registers the names it loads; the state is set directly here.
  registerRemoteTranslationName('ur.jalandhry', 'Jalandhry');
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

async function open() {
  await act(async () => {
    renderer = TestRenderer.create(
      <TranslationContent
        surahNumber={1}
        ayahNumber={1}
        rewayah="hafs"
        onBack={() => undefined}
      />,
    );
  });
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

it('names the bundled translations in Arabic and a downloaded one as given, never in capitals', async () => {
  expect(currentLanguage).toBe('ar');
  await open();
  const shown = texts();
  expect(shown).toEqual(
    expect.arrayContaining([SAHEEH_AR, CLEAR_QURAN_AR, 'Jalandhry']),
  );
  expect(shown).not.toEqual(
    expect.arrayContaining([expect.stringMatching(/SAHEEH|CLEAR QURAN/)]),
  );
  expect(shown).not.toContain('JALANDHRY');
  for (const name of [SAHEEH_AR, CLEAR_QURAN_AR, 'Jalandhry']) {
    const style = StyleSheet.flatten(textNode(name).props.style);
    expect(style.textTransform).not.toBe('uppercase');
  }
});

it('switching shows the chosen translation by its Arabic name on top', async () => {
  await open();
  const switchTo = root()
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === CLEAR_QURAN_AR).length > 0,
    )
    .pop();
  if (!switchTo) throw new Error('no switch for The Clear Quran');
  await act(async () => {
    switchTo.props.onPress();
  });
  expect(useMushafSettingsStore.getState().selectedTranslationId).toBe(
    'clear-quran',
  );
  const shown = texts();
  // The active name comes first, then the others.
  expect(shown.indexOf(CLEAR_QURAN_AR)).toBeLessThan(shown.indexOf(SAHEEH_AR));
});

it('keeps 44pt Previous and Next buttons in Arabic', async () => {
  await open();
  for (const label of ['السابق', 'التالي']) {
    let node: TestRenderer.ReactTestInstance | null = textNode(label).parent;
    let button: ViewStyle | null = null;
    while (node && !button) {
      if (typeof node.type === 'string') {
        const style = StyleSheet.flatten(node.props.style) as ViewStyle;
        if (style?.minHeight !== undefined) button = style;
      }
      node = node.parent;
    }
    expect(button?.minHeight).toBeGreaterThanOrEqual(44);
  }
});
