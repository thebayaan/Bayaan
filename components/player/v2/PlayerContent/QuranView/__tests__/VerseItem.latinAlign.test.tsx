// @ai-generated
/**
 * In the Arabic UI the verse row is laid out right-to-left, and React Native
 * swaps textAlign left and right there: the transliteration and an English
 * translation, set to 'left', were drawn against the right edge. Text of a
 * left-to-right script now starts at the physical left (textAlign 'right'
 * in an RTL layout), a right-to-left translation (Urdu, Persian...) at the
 * physical right. In the English UI nothing changes (VerseItem.hafsGolden).
 */

import React, {act} from 'react';
import {StyleSheet, type TextStyle} from 'react-native';
import TestRenderer from 'react-test-renderer';

// The app in Arabic.
jest.mock('@/utils/rtl', () => ({
  ...jest.requireActual('@/utils/rtl'),
  isRTL: true,
  appDirection: 'rtl',
  appLayoutDirection: {direction: 'rtl'},
}));

jest.mock('../SkiaVerseText', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../WBWVerseView', () => ({
  WBWVerseView: () => null,
}));

jest.mock('@/components/mushaf/AyahCommunityReflections', () => ({
  AyahCommunityReflections: () => null,
}));

// Renders the formatted string with its style so the test can read both.
jest.mock('@/components/utils/FormattedText', () => {
  const ReactActual = jest.requireActual('react');
  const {Text} = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {text: string; baseStyle?: unknown}) =>
      ReactActual.createElement(
        Text,
        {testID: 'formatted-text', style: props.baseStyle},
        props.text,
      ),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn(() => Promise.resolve())},
}));

jest.mock('@/utils/haptics', () => ({mediumHaptics: jest.fn()}));

jest.mock('@/utils/translationLookup', () => ({
  isBundledTranslation: () => true,
  getBundledFootnotes: () => undefined,
}));

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      bookmarkedVerseKeys: new Set(),
      notedVerseKeys: new Set(),
      highlights: {},
    })),
  };
});

jest.mock('@/store/translationStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTranslationStore: create(() => ({downloadedMeta: []}))};
});

import {VerseItem} from '../VerseItem';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useTranslationStore} from '@/store/translationStore';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
const TRANSLITERATION = 'TRANSLITERATION';
const TRANSLATION = 'TRANSLATION';
const VERSE = {
  verse_key: '1:4',
  surah_number: 1,
  ayah_number: 4,
  text: 'BUNDLED-HAFS-TEXT',
  transliteration: TRANSLITERATION,
  translation: TRANSLATION,
} as never;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(translationId?: string) {
  act(() => {
    renderer = TestRenderer.create(
      <VerseItem
        verse={VERSE}
        onVersePress={() => undefined}
        textColor="#111111"
        borderColor="#cccccc"
        showTranslation
        showTransliteration
        showTajweed={false}
        arabicFontFamily="Uthmani"
        transliterationFontSize={15}
        translationFontSize={14}
        arabicFontSize={24}
        fontMgr={FONT_MGR}
        dkFontFamily="DigitalKhattV2"
        indexedTajweedData={null}
        translationName="Source"
        translationId={translationId}
        source="mushaf"
      />,
    );
  });
}

/** The flattened style of the host Text rendering `text`. */
function styleOf(text: string): TextStyle {
  const node = renderer!.root.find(
    n => typeof n.type === 'string' && n.props.children === text,
  );
  return StyleSheet.flatten(node.props.style) as TextStyle;
}

beforeEach(() => {
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  useTranslationStore.setState({downloadedMeta: []} as never);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

it('sets the transliteration from the physical left', () => {
  render();
  expect(styleOf(TRANSLITERATION)).toMatchObject({
    textAlign: 'right', // swapped by the RTL layout: physical left
    writingDirection: 'ltr',
  });
});

it('sets a bundled (English) translation and its source from the left', () => {
  render('saheeh');
  expect(styleOf(TRANSLATION)).toMatchObject({
    textAlign: 'right',
    writingDirection: 'ltr',
  });
  expect(styleOf('Source').textAlign).toBe('right');
});

it('sets a downloaded right-to-left translation from the right', () => {
  useTranslationStore.setState({
    downloadedMeta: [{identifier: 'ur.jalandhry', direction: 'rtl'}],
  } as never);
  render('ur.jalandhry');
  expect(styleOf(TRANSLATION)).toMatchObject({
    textAlign: 'left', // swapped by the RTL layout: physical right
    writingDirection: 'rtl',
  });
  expect(styleOf('Source').textAlign).toBe('left');
  // the transliteration is Latin whatever the translation
  expect(styleOf(TRANSLITERATION).textAlign).toBe('right');
});

it('a downloaded left-to-right translation stays on the left', () => {
  useTranslationStore.setState({
    downloadedMeta: [{identifier: 'fr.hamidullah', direction: 'ltr'}],
  } as never);
  render('fr.hamidullah');
  expect(styleOf(TRANSLATION).textAlign).toBe('right');
});
