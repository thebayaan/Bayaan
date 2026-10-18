// @ai-generated
/**
 * The verse transliteration (data/transliteration.json) spells the Hafs
 * reading. Under a rewayah's text (a rewayah track in the player, a rewayah
 * mushaf's verse list) it would present the Hafs reading as the rewayah's,
 * e.g. "Maaliki" under Warsh "malik", so it is not shown there. Under Hafs
 * text it is shown exactly as before. Fixtures use placeholder strings.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

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

// Renders the formatted string so the test can see which lines are shown.
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
    })),
  };
});

jest.mock('@/store/verseSelectionStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseSelectionStore: create(() => ({
      selectedVerseKey: null,
      selectVerse: () => undefined,
    })),
  };
});

import {VerseItem} from '../VerseItem';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
const TRANSLITERATION = 'HAFS-READING-TRANSLITERATION';
const TRANSLATION = 'TRANSLATION-TEXT';
const VERSE = {
  verse_key: '1:4',
  surah_number: 1,
  ayah_number: 4,
  text: 'BUNDLED-HAFS-TEXT',
  transliteration: TRANSLITERATION,
  translation: TRANSLATION,
} as never;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(props: {rewayah?: 'hafs' | 'warsh'; showWBW?: boolean}) {
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
        rewayah={props.rewayah}
        showWBW={props.showWBW}
      />,
    );
  });
}

/** The strings the row renders through FormattedText, in order. */
function formattedLines(): string[] {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root
    .findAll(
      n => n.props.testID === 'formatted-text' && typeof n.type === 'string',
    )
    .map(n => String(n.props.children));
}

beforeEach(() => {
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('under rewayah text: no Hafs transliteration', () => {
  it('a rewayah track in the player', () => {
    render({rewayah: 'warsh'});
    expect(formattedLines()).toEqual([TRANSLATION]);
  });

  it('a rewayah mushaf verse list (no rewayah prop)', () => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    render({});
    expect(formattedLines()).toEqual([TRANSLATION]);
  });

  it('word-by-word mode in a rewayah context', () => {
    render({rewayah: 'warsh', showWBW: true});
    expect(formattedLines()).toEqual([TRANSLATION]);
  });
});

describe('under Hafs text: unchanged', () => {
  it('shows the transliteration above the translation', () => {
    render({rewayah: 'hafs'});
    expect(formattedLines()).toEqual([TRANSLITERATION, TRANSLATION]);
  });

  it('a Hafs track over a rewayah mushaf still shows it', () => {
    useMushafSettingsStore.setState({rewayah: 'warsh'});
    render({rewayah: 'hafs'});
    expect(formattedLines()).toEqual([TRANSLITERATION, TRANSLATION]);
  });

  it('a Hafs mushaf verse list (no rewayah prop), word-by-word too', () => {
    render({});
    expect(formattedLines()).toEqual([TRANSLITERATION, TRANSLATION]);
    act(() => renderer?.unmount());
    render({showWBW: true});
    expect(formattedLines()).toEqual([TRANSLITERATION, TRANSLATION]);
  });
});
