// @ai-generated
/**
 * Bookmark chips of the mushaf search read like the Bookmarks list
 * (decision 3), on real slots of the Release 1 words DBs (fixture): each
 * chip names the bookmark's verse in the rewayah it was saved in (the two
 * parts of split Hafs 1:7 are Warsh 1:6 and 1:7), names that rewayah when
 * another one is on screen, and shows no number while its verses load.
 * Hafs bookmarks with Hafs on screen read exactly as before. A press hands
 * the bookmark itself to the search view, which opens it.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import type {VerseBookmark} from '@/types/verse-annotations';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

let mockBookmarks: VerseBookmark[] = [];
let mockUnitsReady = true;

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAllBookmarks: () => Promise.resolve(mockBookmarks),
  },
}));

jest.mock('@/hooks/useRewayahVerseUnits', () => ({
  useRewayahVerseUnits: (rewayah: RewayahId | null) => {
    if (!rewayah) return {units: null, status: 'unavailable'};
    if (!mockUnitsReady) return {units: null, status: 'loading'};
    const {
      fixtureUnits,
    } = require('@/services/verse-annotations/__fixtures__/verseUnitsTestData');
    return {units: fixtureUnits(rewayah), status: 'ready'};
  },
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111', textSecondary: '#666'}},
  }),
}));

import {BookmarkChips, warmBookmarkCache} from '../BookmarkChips';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function bookmark(
  verseKey: string,
  rewayahId: RewayahId | undefined,
  id: string,
): VerseBookmark {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {
    id,
    verseKey,
    surahNumber: surah,
    ayahNumber: ayah,
    createdAt: 0,
    rewayahId,
  };
}

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function render(
  shownRewayah: RewayahId,
  onPress: (bookmark: VerseBookmark) => void,
) {
  await warmBookmarkCache();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BookmarkChips shownRewayah={shownRewayah} onPress={onPress} />,
    );
  });
  mounted.push(renderer);
  return renderer;
}

/** The chips' press handlers, in order (one per chip). */
function chipPresses(renderer: TestRenderer.ReactTestRenderer): (() => void)[] {
  const presses: (() => void)[] = [];
  for (const node of renderer.root.findAll(
    // Pressables only: not BookmarkChips itself (it has `shownRewayah`).
    n => typeof n.props.onPress === 'function' && !('shownRewayah' in n.props),
  )) {
    const press = node.props.onPress as () => void;
    if (!presses.includes(press)) presses.push(press);
  }
  return presses;
}

function chipTexts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(n => n.type === (Text as never))
    .filter(
      t => StyleSheet.flatten(t.props.style)?.textTransform !== 'uppercase',
    )
    .map(t => String(t.props.children));
}

beforeEach(() => {
  mockUnitsReady = true;
  mockBookmarks = [
    bookmark('1:7', 'warsh', 'a'),
    {...bookmark('1:7', 'warsh', 'b'), verseKey: '1:7:5'},
    bookmark('1:7', 'hafs', 'c'),
    bookmark('106:4', undefined, 'd'),
  ];
});

afterEach(() => {
  act(() => {
    for (const renderer of mounted.splice(0)) renderer.unmount();
  });
});

it('Hafs bookmarks with Hafs on screen read as before', async () => {
  mockBookmarks = [
    bookmark('2:255', 'hafs', 'a'),
    bookmark('1:7', 'hafs', 'b'),
  ];
  const onPress = jest.fn();
  const r = await render('hafs', onPress);
  expect(chipTexts(r)).toEqual(['Al-Baqarah 2:255', 'Al-Fatihah 1:7']);
  act(() => chipPresses(r)[1]());
  expect(onPress).toHaveBeenLastCalledWith(mockBookmarks[1]);
});

it('Warsh on screen: each bookmark in the rewayah it was saved in', async () => {
  const onPress = jest.fn();
  const r = await render('warsh', onPress);
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah 1:6',
    'Al-Fatihah 1:7',
    'Al-Fatihah 1:7 · Hafs',
    'Quraysh 106:4 · Hafs',
  ]);
  act(() => chipPresses(r)[1]());
  expect(onPress).toHaveBeenLastCalledWith(mockBookmarks[1]);
});

it('Hafs on screen: Warsh bookmarks name Warsh', async () => {
  const r = await render('hafs', jest.fn());
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah 1:6 · Warsh',
    'Al-Fatihah 1:7 · Warsh',
    'Al-Fatihah 1:7',
    'Quraysh 106:4',
  ]);
});

it('no verse number while the saved rewayah verses load', async () => {
  mockUnitsReady = false;
  const r = await render('warsh', jest.fn());
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah',
    'Al-Fatihah',
    'Al-Fatihah 1:7 · Hafs',
    'Quraysh 106:4 · Hafs',
  ]);
});
