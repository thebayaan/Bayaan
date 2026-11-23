// @ai-generated
/**
 * RootLemmaChips in the Arabic UI. Twelve lemmas of the corpus carry a
 * homonym number (مَٰلِك2): the chip shows it in the app's digits (مَٰلِك٢),
 * as Word Study's lemma row and the chip's spoken label do, and choosing
 * the chip still passes the lemma's id. The app language is fixed when the
 * app starts, so this runs in its own file.
 */
import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import i18n from 'i18next';
import {currentLanguage} from '@/i18n/language';
import type {
  QuranLemma,
  QuranRoot,
} from '@/services/search/QuranSearchDataService';
import {RootLemmaChips} from '../RootLemmaChips';

jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'ar'}],
}));
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

const root: QuranRoot = {id: 7, root: 'م ل ك', words: 206, ayahs: 191};
const lemmas: QuranLemma[] = [
  {id: 1, rootId: 7, lemma: 'مَلِك', words: 11, ayahs: 11},
  {id: 2, rootId: 7, lemma: 'مَٰلِك2', words: 1, ayahs: 1},
];

function render(onSelect: (lemmaId: number | null) => void) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <RootLemmaChips
        root={root}
        lemmas={lemmas}
        selected={null}
        onSelect={onSelect}
      />,
    );
  });
  return tree;
}

const textNodes = (node: TestRenderer.ReactTestInstance) => {
  const text: unknown = Text;
  return node.findAll(child => child.type === text);
};
const texts = (tree: TestRenderer.ReactTestRenderer) =>
  textNodes(tree.root).map(node => [node.props.children].flat().join(''));

beforeAll(async () => {
  await i18n.changeLanguage('ar');
});

it('runs in the Arabic UI', () => {
  expect(currentLanguage).toBe('ar');
});

it('shows a homonym number in Arabic-Indic digits', () => {
  const tree = render(jest.fn());
  const shown = texts(tree);
  expect(shown).toContain('مَٰلِك٢');
  expect(shown.join(' ')).not.toMatch(/[0-9]/);
});

it('passes the lemma id when its chip is chosen', () => {
  const onSelect = jest.fn();
  const tree = render(onSelect);
  const chip = tree.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'tab' &&
        typeof node.props.onPress === 'function',
    )
    .find(node => textNodes(node).some(t => t.props.children === 'مَٰلِك٢'));
  expect(chip).toBeDefined();
  act(() => chip?.props.onPress());
  expect(onSelect).toHaveBeenCalledWith(2);
});
