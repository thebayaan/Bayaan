// @ai-generated
/**
 * Bookmark and note items of the collection in the rewayah they were saved
 * in (decision 3), on real slots of the Release 1 words DBs (fixture):
 *  - a row saved in Warsh shows Warsh's own verse number and Warsh's own
 *    text of exactly that verse (the later part of split Hafs 1:7 is 1:7);
 *  - no verse number while Warsh's verses load (never a Hafs number next
 *    to the Warsh pill);
 *  - Hafs rows render exactly as before: the Hafs label and the
 *    SkiaVersePreview of the stored keys.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text, View} from 'react-native';

const mockPreviewProps: Record<string, unknown>[] = [];
const mockSkiaTexts: string[] = [];
let mockUnitsResult: {units: unknown; status: string} = {
  units: null,
  status: 'loading',
};
const mockUnitsRequests: (string | null)[] = [];

jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPreviewProps.push(props);
    return null;
  },
}));

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/SkiaVerseText',
  () => ({
    __esModule: true,
    default: (props: {text: string}) => {
      mockSkiaTexts.push(props.text);
      return null;
    },
  }),
);

jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: string | null) => {
    mockUnitsRequests.push(rewayah);
    return rewayah ? mockUnitsResult : {units: null, status: 'unavailable'};
  },
}));

jest.mock('@/hooks/useMushafFontMgr', () => ({
  useMushafFontMgr: () => ({fake: 'fontMgr'}),
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {card: '#fff', text: '#111', textSecondary: '#666'},
      fonts: {medium: 'Medium', regular: 'Regular'},
    },
  }),
}));

import {BookmarkItem} from '../BookmarkItem';
import {NoteItem} from '../NoteItem';
import {
  fixtureUnits,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    // The renderer's own React types differ from the app's.
    renderer = TestRenderer.create(element as never);
  });
  // Give the Skia preview its width.
  for (const view of renderer.root.findAll(n => n.type === (View as never))) {
    const onLayout = view.props.onLayout as
      | ((e: {nativeEvent: {layout: {width: number}}}) => void)
      | undefined;
    if (onLayout) {
      act(() => onLayout({nativeEvent: {layout: {width: 320}}}));
    }
  }
  return renderer;
}

/** Every string drawn in a Text (except the surah-name glyph), in order. */
function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(n => n.type === (Text as never))
    .filter(t => StyleSheet.flatten(t.props.style)?.fontFamily !== 'SurahNames')
    .map(t => {
      const children = t.props.children as unknown;
      return Array.isArray(children)
        ? children.join('')
        : String(children ?? '');
    })
    .filter(Boolean);
}

const noop = () => undefined;

beforeEach(() => {
  mockPreviewProps.length = 0;
  mockSkiaTexts.length = 0;
  mockUnitsRequests.length = 0;
  mockUnitsResult = {units: fixtureUnits('warsh'), status: 'ready'};
});

describe('BookmarkItem', () => {
  it('Hafs row: Hafs label and the preview of before', () => {
    const r = render(
      <BookmarkItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7"
        rewayahId="hafs"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:7']);
    expect(mockPreviewProps).toEqual([
      {
        verseKey: '1:7',
        verseKeys: undefined,
        numberOfLines: undefined,
        rewayah: 'hafs',
      },
    ]);
    expect(mockSkiaTexts).toEqual([]);
    expect(mockUnitsRequests.every(request => request === null)).toBe(true);
  });

  it('Warsh row on the later part of Hafs 1:7: Warsh 1:7 and its own text', () => {
    const warsh = fixtureUnits('warsh');
    const r = render(
      <BookmarkItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7:5"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:7', 'Warsh']);
    expect(mockPreviewProps).toEqual([]);
    expect(mockSkiaTexts[mockSkiaTexts.length - 1]).toBe(
      warsh.unitText(unitOf(warsh, '1:7')),
    );
  });

  it('Warsh row on the first part: Warsh 1:6', () => {
    const warsh = fixtureUnits('warsh');
    const r = render(
      <BookmarkItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7:1"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:6', 'Warsh']);
    expect(mockSkiaTexts[mockSkiaTexts.length - 1]).toBe(
      warsh.unitText(unitOf(warsh, '1:6')),
    );
  });

  it('Warsh row saved before verse units on Hafs 1:7: Warsh 1:6-7 with both texts', () => {
    // develop wrote ("1:7", "warsh") for what it showed as 1:7: all of
    // Hafs 1:7, Warsh 1:6 and 1:7.
    const warsh = fixtureUnits('warsh');
    const r = render(
      <BookmarkItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:6-7', 'Warsh']);
    expect(mockSkiaTexts[mockSkiaTexts.length - 1]).toBe(
      `${warsh.unitText(unitOf(warsh, '1:6'))} ${warsh.unitText(
        unitOf(warsh, '1:7'),
      )}`,
    );
  });

  it('no number and no text while the Warsh verses load', () => {
    mockUnitsResult = {units: null, status: 'loading'};
    const r = render(
      <BookmarkItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7:5"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['Warsh']);
    expect(mockPreviewProps).toEqual([]);
    expect(mockSkiaTexts).toEqual([]);
  });
});

describe('NoteItem', () => {
  it('Hafs range note: the label and preview of before', () => {
    const r = render(
      <NoteItem
        surahName="Al-Asr"
        surahNumber={103}
        ayahNumber={1}
        verseKey="103:1"
        verseKeys={['103:1', '103:2']}
        notePreview="text"
        rewayahId="hafs"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['103:1-2', 'text']);
    expect(mockPreviewProps).toEqual([
      {
        verseKey: '103:1',
        verseKeys: ['103:1', '103:2'],
        numberOfLines: 3,
        rewayah: 'hafs',
      },
    ]);
  });

  it('Warsh note on both parts of Hafs 1:7: Warsh 1:6-7 with their texts', () => {
    const warsh = fixtureUnits('warsh');
    const r = render(
      <NoteItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7:1"
        verseKeys={['1:7:1', '1:7:5']}
        notePreview="text"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:6-7', 'Warsh', 'text']);
    expect(mockSkiaTexts[mockSkiaTexts.length - 1]).toBe(
      `${warsh.unitText(unitOf(warsh, '1:6'))} ${warsh.unitText(
        unitOf(warsh, '1:7'),
      )}`,
    );
  });

  it('a Warsh note saved before verse units on Hafs 1:7: Warsh 1:6-7 with their texts', () => {
    const warsh = fixtureUnits('warsh');
    const r = render(
      <NoteItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={7}
        verseKey="1:7"
        notePreview="text"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['1:6-7', 'Warsh', 'text']);
    expect(mockSkiaTexts[mockSkiaTexts.length - 1]).toBe(
      `${warsh.unitText(unitOf(warsh, '1:6'))} ${warsh.unitText(
        unitOf(warsh, '1:7'),
      )}`,
    );
  });

  it('a Warsh note on the unnumbered basmala keeps its Hafs reference', () => {
    const r = render(
      <NoteItem
        surahName="Al-Fatihah"
        surahNumber={1}
        ayahNumber={1}
        verseKey="1:1"
        notePreview="text"
        rewayahId="warsh"
        onPress={noop}
        onOptionsPress={noop}
      />,
    );
    expect(texts(r)).toEqual(['Hafs 1:1', 'Warsh', 'text']);
    // The rewayah's text of that Hafs verse, as before.
    expect(mockPreviewProps).toEqual([
      {
        verseKey: '1:1',
        verseKeys: undefined,
        numberOfLines: undefined,
        rewayah: 'warsh',
      },
    ]);
  });
});
