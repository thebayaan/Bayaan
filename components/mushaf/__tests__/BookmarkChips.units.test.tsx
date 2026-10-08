// @ai-generated
/**
 * Bookmark chips of the mushaf search in the numbering of the rewayah on
 * screen (decision 3), on real slots of the Release 1 words DBs (fixture):
 * Hafs on screen shows every chip as before; Warsh on screen labels and
 * opens the Warsh verse each bookmark marks (the two parts of split Hafs
 * 1:7 stay apart), and shows no number while Warsh's verses load.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import type {VerseBookmark} from '@/types/verse-annotations';

let mockBookmarks: VerseBookmark[] = [];

jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAllBookmarks: () => Promise.resolve(mockBookmarks),
  },
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111', textSecondary: '#666'}},
  }),
}));

import {BookmarkChips, warmBookmarkCache} from '../BookmarkChips';
import type {BookmarkChipView, ShownVerses} from '../mushafSearchVerses';
import {fixtureUnits} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

function bookmark(
  verseKey: string,
  rewayahId: RewayahId,
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

async function render(
  shown: ShownVerses,
  onPress: (view: BookmarkChipView, surahId: number) => void,
) {
  await warmBookmarkCache();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BookmarkChips shown={shown} onPress={onPress} />,
    );
  });
  return renderer;
}

/** The chips' press handlers, in order (one per chip). */
function chipPresses(renderer: TestRenderer.ReactTestRenderer): (() => void)[] {
  const presses: (() => void)[] = [];
  for (const node of renderer.root.findAll(
    // Pressables only: not BookmarkChips itself (it has `shown`).
    n => typeof n.props.onPress === 'function' && !('shown' in n.props),
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
  mockBookmarks = [
    bookmark('1:7', 'warsh', 'a'),
    {...bookmark('1:7', 'warsh', 'b'), verseKey: '1:7:5'},
    bookmark('1:7', 'hafs', 'c'),
    bookmark('106:4', 'hafs', 'd'),
  ];
});

it('Hafs on screen: every chip as before', async () => {
  const onPress = jest.fn();
  const r = await render({rewayah: 'hafs', units: null}, onPress);
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah 1:7',
    'Al-Fatihah 1:7',
    'Al-Fatihah 1:7',
    'Quraysh 106:4',
  ]);
  act(() => chipPresses(r)[1]());
  expect(onPress).toHaveBeenLastCalledWith(
    {
      label: '1:7',
      target: {
        verseKey: '1:7',
        rewayah: 'hafs',
        pageVerseKey: '1:7',
        anchor: '1:7',
      },
      pageVerseKey: '1:7',
    },
    1,
  );
});

it('Warsh on screen: the Warsh verse each bookmark marks', async () => {
  const onPress = jest.fn();
  const r = await render(
    {rewayah: 'warsh', units: fixtureUnits('warsh')},
    onPress,
  );
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah 1:6',
    'Al-Fatihah 1:7',
    'Al-Fatihah 1:6-7',
    'Quraysh 106:4-5',
  ]);
  act(() => chipPresses(r)[1]());
  expect(onPress.mock.calls[0][0].target).toEqual({
    verseKey: '1:7',
    rewayah: 'warsh',
    pageVerseKey: '1:7',
    anchor: '1:7:5',
  });
});

it('no verse numbers while the Warsh verses load', async () => {
  const r = await render({rewayah: 'warsh', units: null}, jest.fn());
  expect(chipTexts(r)).toEqual([
    'Al-Fatihah',
    'Al-Fatihah',
    'Al-Fatihah',
    'Quraysh',
  ]);
});
