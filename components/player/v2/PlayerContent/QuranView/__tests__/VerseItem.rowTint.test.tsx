// @ai-generated
/**
 * The row's background in the verse lists: the verse the list's own
 * selection holds, or the verse the mushaf's list modes pass as `selected`
 * (the verse a jump took the reader to, held in the mushaf's selection
 * store, which the row does not read), and the verse's colour highlight.
 */

import React, {act} from 'react';
import {StyleSheet} from 'react-native';
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

jest.mock('@/components/utils/FormattedText', () => ({
  __esModule: true,
  default: () => null,
}));

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

jest.mock('@/store/verseSelectionStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseSelectionStore: create(() => ({
      selectedVerseKey: null,
      selectedRewayah: null,
      selectVerse: () => undefined,
    })),
  };
});

import {VerseItem} from '../VerseItem';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
const VERSE = {
  verse_key: '2:255',
  surah_number: 2,
  ayah_number: 255,
  text: 'BUNDLED-HAFS-TEXT',
  transliteration: 'TRANSLITERATION',
  translation: 'TRANSLATION',
} as never;
// textColor #111111 at the alphas VerseItem uses
const SELECTED_BG = 'rgba(17, 17, 17, 0.06)';
const ACTIVE_BG = 'rgba(17, 17, 17, 0.12)';

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(props: {selected?: boolean; isActive?: boolean} = {}) {
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
        source="mushaf"
        {...props}
      />,
    );
  });
}

/** The row's background colour (its outer Pressable). */
function rowBackground(): string | undefined {
  if (!renderer) throw new Error('nothing rendered');
  const row = renderer.root.findAll(
    n => typeof n.props.onLongPress === 'function' && n.props.style,
  )[0];
  return StyleSheet.flatten(row.props.style).backgroundColor as
    | string
    | undefined;
}

beforeEach(() => {
  useMushafSettingsStore.setState({rewayah: 'hafs', mushafRenderer: 'dk_v2'});
  useVerseSelectionStore.setState({
    selectedVerseKey: null,
    selectedRewayah: null,
  });
  useVerseAnnotationsStore.setState({highlights: {}} as never);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('selection', () => {
  it('is plain when nothing selects it', () => {
    render();
    expect(rowBackground()).toBeUndefined();
  });

  it('shows the selection tint for the verse a jump took the reader to', () => {
    render({selected: true});
    expect(rowBackground()).toBe(SELECTED_BG);
  });

  it("still shows the list's own selection", () => {
    useVerseSelectionStore.setState({
      selectedVerseKey: '2:255',
      selectedRewayah: 'hafs',
    });
    render();
    expect(rowBackground()).toBe(SELECTED_BG);
  });

  it('paints over the follow-along tint, as before', () => {
    render({selected: true, isActive: true});
    expect(rowBackground()).toBe(SELECTED_BG);
    act(() => renderer?.unmount());
    render({isActive: true});
    expect(rowBackground()).toBe(ACTIVE_BG);
  });
});

describe('colour highlight', () => {
  it('tints the row in the colour picked in the verse sheet', () => {
    useVerseAnnotationsStore.setState({
      highlights: {'2:255': 'yellow'},
    } as never);
    render();
    expect(rowBackground()).toBe(HIGHLIGHT_COLORS.yellow);
  });

  it("another verse's highlight leaves the row plain", () => {
    useVerseAnnotationsStore.setState({
      highlights: {'2:256': 'green'},
    } as never);
    render();
    expect(rowBackground()).toBeUndefined();
  });

  it('follows the store: recoloured and removed', () => {
    useVerseAnnotationsStore.setState({
      highlights: {'2:255': 'yellow'},
    } as never);
    render();
    act(() =>
      useVerseAnnotationsStore.setState({
        highlights: {'2:255': 'purple'},
      } as never),
    );
    expect(rowBackground()).toBe(HIGHLIGHT_COLORS.purple);
    act(() => useVerseAnnotationsStore.setState({highlights: {}} as never));
    expect(rowBackground()).toBeUndefined();
  });

  it('lies below the follow-along and selection tints, as on the pages', () => {
    useVerseAnnotationsStore.setState({
      highlights: {'2:255': 'yellow'},
    } as never);
    render({isActive: true});
    expect(rowBackground()).toBe(ACTIVE_BG);
    act(() => renderer?.unmount());
    render({selected: true});
    expect(rowBackground()).toBe(SELECTED_BG);
  });
});
