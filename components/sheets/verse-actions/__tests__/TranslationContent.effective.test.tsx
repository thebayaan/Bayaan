/**
 * The translation sheet shows the edition actually loaded for the selection
 * (getEffectiveTranslationId), with the real lookup: a selection that is not
 * installed yet (QF 20 replacing the retired bundled Saheeh) shows Clear
 * Quran's text under Clear Quran's name, never an empty "not available" and
 * never the pending edition's name; once 20 is loaded it shows 20.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

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
        background: '#ffffff',
        card: '#ffffff',
      },
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/store/translationStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTranslationStore: create(() => ({downloadedMeta: []}))};
});
jest.mock('@/services/translation/TranslationDbService', () => ({
  translationDbService: {getTranslation: jest.fn(async () => null)},
}));
jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: new Proxy({}, {get: () => () => undefined}),
}));

import {TranslationContent} from '../TranslationContent';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  clearActiveRemoteTranslationCache,
  getBundledTranslation,
  registerRemoteTranslationName,
  setActiveRemoteTranslationCache,
} from '@/utils/translationLookup';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

async function render() {
  await act(async () => {
    renderer = TestRenderer.create(
      <TranslationContent surahNumber={1} ayahNumber={1} onBack={jest.fn()} />,
    );
  });
}

function texts(): string[] {
  if (!renderer) return [];
  return renderer.root
    .findAll(n => (n.type as unknown) === Text)
    .map(n =>
      ([] as unknown[])
        .concat(n.props.children)
        .filter(c => typeof c === 'string')
        .join(''),
    )
    .filter(Boolean);
}

beforeEach(() => {
  // The picker registers every offered edition's name, installed or not.
  registerRemoteTranslationName('20', 'Saheeh International');
  useMushafSettingsStore.setState({selectedTranslationId: '20'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  clearActiveRemoteTranslationCache();
});

it('shows Clear Quran, named as such, while the selection is not installed', async () => {
  await render();
  const shown = texts();
  expect(shown).toContain('THE CLEAR QURAN');
  expect(shown).not.toContain('SAHEEH INTERNATIONAL');
  expect(shown).toContain(getBundledTranslation('1:1', 'clear-quran').trim());
  // Clear Quran is the edition shown, not offered again below it.
  expect(shown.filter(s => s === 'THE CLEAR QURAN')).toHaveLength(1);
});

it('shows the selection once its text is loaded', async () => {
  setActiveRemoteTranslationCache('20', {
    '1:1': 'In the name of Allah,<sup foot_note=9>1</sup> the Merciful',
  });
  await render();
  const shown = texts();
  expect(shown).toContain('SAHEEH INTERNATIONAL');
  expect(shown).toContain('In the name of Allah, the Merciful');
  // Clear Quran is offered as another edition.
  expect(shown).toContain('THE CLEAR QURAN');
});
