// @ai-generated
/**
 * Collection → Notes kept showing a note's old text after it was edited in
 * the note sheet, and kept listing a note that was deleted there (tapping it
 * again opened an empty "Add note" form). The list now reloads when the sheet
 * closes, without blanking to "Loading…". The route lives in app/, so its
 * test lives here.
 */
import React from 'react';
import {Animated, Text} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import type {VerseNote} from '@/types/verse-annotations';

const mockGetAllNotes = jest.fn<Promise<VerseNote[]>, []>();
const mockShow = jest.fn<Promise<unknown>, [string, unknown]>();

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111', textSecondary: '#555', background: '#fff'}},
  }),
}));
jest.mock('@/hooks/useGlassProps', () => ({USE_GLASS: false}));
jest.mock('@/hooks/useBottomInset', () => ({
  useLibraryListBottomPadding: () => 0,
}));
jest.mock('@/hooks/useCollectionNativeHeader', () => ({
  useCollectionNativeHeader: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('@/components/collection/CollectionScreenHeader', () => ({
  CollectionScreenHeader: () => null,
  CollectionHeaderActions: () => null,
  CollectionSearchField: () => null,
}));
jest.mock('@/hooks/useCollectionPreviews', () => ({
  useCollectionPreviews: () => ({}),
  usePlaylistCovers: () => ({}),
}));
jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');
  return {
    useRouter: () => ({back: jest.fn(), push: jest.fn()}),
    useLocalSearchParams: () => ({}),
    // The screen is focused once, when it mounts.
    useFocusEffect: (effect: () => void) =>
      ReactActual.useEffect(() => effect(), [effect]),
  };
});
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/services/dataService', () => ({
  getSurahById: (id: number) => ({id, name: `Surah ${id}`}),
}));
jest.mock('@/i18n/format', () => ({
  getSurahDisplayName: (surah: {name: string}) => surah.name,
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getAllNotes: () => mockGetAllNotes(),
    deleteNoteById: jest.fn(),
    getNotesCountForVerse: jest.fn(),
  },
}));
jest.mock('@/store/verseAnnotationsStore', () => ({
  useVerseAnnotationsStore: {getState: () => ({removeNote: jest.fn()})},
}));
jest.mock('@/components/collection/NoteItem', () => ({NoteItem: () => null}));
jest.mock('@/components/collection/CollectionStickyHeader', () => ({
  CollectionStickyHeader: () => null,
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {
    show: (id: string, options: unknown) => mockShow(id, options),
  },
}));
jest.mock('@/hooks/useSavedVerseDescription', () => ({
  describeSavedVerseNow: () => null,
}));
jest.mock('@/services/verse-annotations/unitAnnotations', () => ({
  savedVerseSubtitle: () => '',
  savedVerseRouteParams: jest.fn(),
}));
jest.mock('@/components/sheets/options/OptionsMenu', () => ({
  useNativeOptionsMenu: () => false,
}));
jest.mock('@/components/sheets/options/collectionOptions', () => ({
  CollectionOptionsMenu: () => null,
}));

import NotesScreen from '@/app/(tabs)/(c.collection)/collection/notes';
import {NoteItem} from '@/components/collection/NoteItem';

const note = (id: string, content: string): VerseNote => ({
  id,
  verseKey: '2:255',
  surahNumber: 2,
  ayahNumber: 255,
  content,
  createdAt: 1,
  updatedAt: 1,
});

const flush = async () => {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  });
};

const rows = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => (node.type as unknown) === NoteItem);

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === Text)
    .map(node => node.props.children);

const listOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.find(node => (node.type as unknown) === Animated.FlatList);

let mounted: TestRenderer.ReactTestRenderer | null = null;
let closeSheet: () => void = () => undefined;

async function render(): Promise<TestRenderer.ReactTestRenderer> {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NotesScreen />);
  });
  mounted = tree;
  await flush();
  return tree;
}

// The first render loads React Native's list modules; on a cold transform
// cache that alone can pass Jest's 5 s default.
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  // show() resolves when the sheet has closed, as the real one does.
  mockShow.mockImplementation(
    () =>
      new Promise<unknown>(resolve => {
        closeSheet = () => resolve(undefined);
      }),
  );
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
});

it('shows the edited text once the note sheet closes', async () => {
  mockGetAllNotes.mockResolvedValue([note('n1', 'old text')]);
  const tree = await render();
  expect(rows(tree).map(r => r.props.notePreview)).toEqual(['old text']);
  const list = listOf(tree);

  act(() => {
    rows(tree)[0].props.onPress();
  });
  expect(mockShow).toHaveBeenCalledWith(
    'verse-note',
    expect.objectContaining({
      payload: expect.objectContaining({noteId: 'n1'}),
    }),
  );

  // The sheet saved the new text, then closed.
  mockGetAllNotes.mockResolvedValue([note('n1', 'new text')]);
  closeSheet();
  await flush();

  expect(rows(tree).map(r => r.props.notePreview)).toEqual(['new text']);
  // Same list instance: it was never swapped for the "Loading…" view.
  expect(listOf(tree)).toBe(list);
});

it('drops a note that was deleted in the sheet', async () => {
  mockGetAllNotes.mockResolvedValue([
    note('n1', 'first'),
    note('n2', 'second'),
  ]);
  const tree = await render();
  expect(rows(tree)).toHaveLength(2);

  act(() => {
    rows(tree)[0].props.onPress();
  });
  mockGetAllNotes.mockResolvedValue([note('n2', 'second')]);
  closeSheet();
  await flush();

  expect(rows(tree).map(r => r.props.notePreview)).toEqual(['second']);
});

it('does not blank to "Loading…" while it refreshes', async () => {
  mockGetAllNotes.mockResolvedValue([note('n1', 'old text')]);
  const tree = await render();

  act(() => {
    rows(tree)[0].props.onPress();
  });
  let finishReload: (notes: VerseNote[]) => void = () => undefined;
  mockGetAllNotes.mockReturnValue(
    new Promise<VerseNote[]>(resolve => {
      finishReload = resolve;
    }),
  );
  closeSheet();
  await flush();

  expect(texts(tree)).not.toContain('Loading…');
  expect(rows(tree)).toHaveLength(1);

  finishReload([note('n1', 'new text')]);
  await flush();
  expect(rows(tree).map(r => r.props.notePreview)).toEqual(['new text']);
});
