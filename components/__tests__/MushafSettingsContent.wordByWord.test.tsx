/**
 * The Word by Word options of Mushaf settings. Its meanings are English (the
 * only word-by-word data), so the option says so in both languages instead
 * of a bare "Translation", while the verse translation keeps its own label.
 * A change is saved for this session's UI language only.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      typography: {mediumSize: 14, smallSize: 12},
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        textTertiary: '#999999',
        background: '#ffffff',
        backgroundSecondary: '#f5f5f5',
        card: '#ffffff',
        border: '#dddddd',
        primary: '#0a7d5a',
      },
    },
    themeMode: 'light',
  }),
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: false},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {initialized: false},
}));
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({__esModule: true, default: () => null}),
);
jest.mock('@/components/Icons', () => new Proxy({}, {get: () => () => null}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/services/recitation/recitationAvailability', () => ({
  RECITATION_AVAILABLE: false,
}));
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  recitationModelOnPhone: jest.fn(async () => false),
  removeRecitationModel: jest.fn(async () => undefined),
}));
jest.mock('@/services/recitation/RecitationLogDatabase', () => ({
  recitationLogDatabase: {},
}));
jest.mock('@/components/sheets/rewayahSelection', () => ({
  chooseMushafRenderer: jest.fn(async () => undefined),
  chooseMushafRewayah: jest.fn(async () => undefined),
}));

import {MushafSettingsContent} from '../MushafSettingsContent';
import {currentLanguage} from '@/i18n/language';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  useMushafSettingsStore.setState({
    viewMode: 'mushaf',
    wbwShowTranslation: true,
    wbwShowTransliteration: false,
    readingAidsInOtherLanguages: {},
  });
});

afterEach(async () => {
  act(() => renderer?.unmount());
  renderer = null;
  await i18n.changeLanguage('en');
});

function render(
  context: 'mushaf' | 'player' = 'mushaf',
): TestRenderer.ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(<MushafSettingsContent context={context} />);
  });
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every string drawn in a Text. */
function texts(root: TestRenderer.ReactTestInstance): string[] {
  return root
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

/** The checkbox rows of the Word by Word options. */
function checkboxes(root: TestRenderer.ReactTestInstance) {
  return root
    .findAll(
      n =>
        n.props.accessibilityRole === 'checkbox' &&
        typeof n.props.onPress === 'function',
    )
    .map(row => ({
      label: texts(row).join(''),
      checked: row.props.accessibilityState?.checked as boolean,
      press: () => act(() => row.props.onPress()),
    }));
}

it.each([
  ['en', 'English Meanings', 'Transliteration'],
  ['ar', 'المعاني بالإنجليزية', 'النطق اللاتيني'],
])(
  'names the meanings option for their language (%s)',
  async (language, meanings, transliteration) => {
    await i18n.changeLanguage(language);
    const root = render();
    expect(checkboxes(root).map(row => row.label)).toEqual([
      meanings,
      transliteration,
    ]);
    // Not the bare "Translation" of the verse translation.
    expect(texts(root)).not.toContain(
      i18n.t('settings:mushafSettings.translation'),
    );
  },
);

it('turns the English meanings on and off', () => {
  const root = render();
  const meanings = () => checkboxes(root)[0];
  expect(meanings().checked).toBe(true);
  meanings().press();
  expect(useMushafSettingsStore.getState().wbwShowTranslation).toBe(false);
  expect(meanings().checked).toBe(false);
  meanings().press();
  expect(useMushafSettingsStore.getState().wbwShowTranslation).toBe(true);
});

it('keeps the verse translation named Translation beside it', async () => {
  await i18n.changeLanguage('ar');
  useMushafSettingsStore.setState({viewMode: 'list'});
  const root = render();
  const shown = texts(root);
  expect(shown).toContain('الترجمة');
  expect(shown).toContain('المعاني بالإنجليزية');
});

it("saves a change for this session's UI language only", async () => {
  expect(currentLanguage).toBe('en');
  // What an Arabic session saved: the English meanings on.
  useMushafSettingsStore.setState({
    readingAidsInOtherLanguages: {ar: {wbwShowTranslation: true}},
  });
  const root = render();
  checkboxes(root)[0].press();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  const saved = JSON.parse(
    (await AsyncStorage.getItem('mushaf-settings')) ?? '{}',
  );
  expect(saved.state.readingAidsByLanguage).toEqual({
    ar: {wbwShowTranslation: true},
    en: expect.objectContaining({wbwShowTranslation: false}),
  });
});
