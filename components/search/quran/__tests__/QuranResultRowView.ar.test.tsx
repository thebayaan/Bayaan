/**
 * QuranResultRowView's counts in the Arabic UI. A root's summary puts the
 * ayah count after في, so it takes the genitive (كلمتان في آيتين, not
 * آيتان); the result header's counts stand alone and stay nominative
 * (آيتان · موضعان). The app language is fixed when the app starts, so this
 * runs in its own file.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import i18n from 'i18next';
import {currentLanguage} from '@/i18n/language';
import type {QuranRoot} from '@/services/search/QuranSearchDataService';
import type {QuranResultRow} from '../quranResultRows';
import {QuranResultRowView} from '../QuranResultRowView';

jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
// Draws ayah rows with Skia; none is rendered here.
jest.mock('../VerseHitRow', () => ({VerseHitRow: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#000000', textSecondary: '#666666', background: '#fff'},
      fonts: {semiBold: 's', medium: 'm', regular: 'r'},
    },
  }),
}));

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

/** Every text the row shows, each Text node joined. */
function texts(row: QuranResultRow): string[] {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <QuranResultRowView
        row={row}
        onVersePress={jest.fn()}
        onRootPress={jest.fn()}
        onLemmaPress={jest.fn()}
        onShowMore={jest.fn()}
      />,
    );
  });
  const text: unknown = Text;
  const shown = tree.root
    .findAll(node => node.type === text)
    .map(node => [node.props.children].flat().join(''));
  act(() => tree.unmount());
  return shown;
}

function rootHeader(words: number, ayahs: number): QuranResultRow {
  const root: QuranRoot = {id: 1, root: 'ء ر ب', words, ayahs};
  return {type: 'quran-root-header', key: 'root', root} as QuranResultRow;
}

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});

it('runs in the Arabic UI', () => {
  expect(currentLanguage).toBe('ar');
});

describe("a root's summary", () => {
  // Western digits: the app's digit postprocessor is not set up in tests.
  it.each([
    // [words, ayahs, summary]
    [2, 2, 'كلمتان في آيتين'],
    [5, 2, '5 كلمات في آيتين'],
    [1, 1, 'كلمة واحدة في آية واحدة'],
    [7, 3, '7 كلمات في 3 آيات'],
    [12, 11, '12 كلمة في 11 آية'],
    [100, 100, '100 كلمة في 100 آية'],
  ])('%i words in %i ayahs: %s', (words, ayahs, summary) => {
    expect(texts(rootHeader(words, ayahs))).toContain(summary);
  });
});

describe("the result header's summary", () => {
  it('keeps its standalone counts nominative', () => {
    const header = {
      type: 'quran-header',
      key: 'header',
      ayahCount: 2,
      matchCount: 2,
      note: 'none',
    } as QuranResultRow;
    expect(texts(header)).toContain('آيتان · موضعان');
  });
});
