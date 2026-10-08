// @ai-generated
/**
 * The note sheet names a note's verses in the numbering of the rewayah the
 * note belongs to (decision 3), from its stored Hafs anchors ("S:A" or
 * "S:A:W"), and previews exactly those verses. A new note in a rewayah is
 * stored by anchors. Hafs notes are shown and saved exactly as before.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text, TextInput} from 'react-native';

const mockPreviews: Array<Record<string, unknown>> = [];
function mockPreview(props: Record<string, unknown>) {
  mockPreviews.push(props);
  return null;
}
jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockPreview(props),
}));
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const Container = (props: {children?: React.ReactNode}) =>
    ReactActual.createElement(View, null, props.children);
  return {
    __esModule: true,
    default: Container,
    ScrollView: Container,
    SheetManager: {hideAll: jest.fn()},
  };
});
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
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
      fonts: {regular: 'Regular', medium: 'Medium', bold: 'Bold'},
    },
    isDarkMode: false,
  }),
}));
const mockNotes = new Map<string, {content: string; rewayahId?: string}>();
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    getNoteById: jest.fn(async (id: string) => mockNotes.get(id) ?? null),
    addNote: jest.fn(async () => undefined),
    updateNote: jest.fn(async () => undefined),
  },
}));
jest.mock('@/store/verseAnnotationsStore', () => ({
  useVerseAnnotationsStore: {getState: () => ({addNote: jest.fn()})},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    isRewayahReady: () => true,
    getRewayahLoadState: () => 'ready',
    subscribeCacheChanges: () => () => undefined,
    getCacheVersion: () => 0,
    ensureRewayahLoaded: jest.fn(async () => undefined),
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));
const mockUnits = {models: new Map<string, unknown>()};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {
    get: (r: string) => mockUnits.models.get(r) ?? null,
    getStatus: (r: string) => (mockUnits.models.has(r) ? 'ready' : 'error'),
  },
}));

import {VerseNoteSheet} from '../VerseNoteSheet';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<'warsh', string[]>;
  };
function buildWarsh(): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  });
  return buildRewayahVerseUnits('warsh', slots, 'warsh@test');
}
const warsh = buildWarsh();

type Payload = React.ComponentProps<typeof VerseNoteSheet>['payload'];
let renderer: TestRenderer.ReactTestRenderer | null = null;

async function openSheet(payload: Payload) {
  const props = {
    sheetId: 'verse-note',
    payload,
  } as React.ComponentProps<typeof VerseNoteSheet>;
  await act(async () => {
    renderer = TestRenderer.create(<VerseNoteSheet {...props} />);
  });
  // The saved note loads on the next microtasks.
  await act(async () => {
    await Promise.resolve();
  });
}

function title(): string {
  if (!renderer) throw new Error('nothing rendered');
  const node = renderer.root
    .findAll(n => (n.type as unknown) === Text)
    .find(n =>
      ([] as unknown[])
        .concat(n.props.children)
        .some(c => c === 'Edit Note' || c === 'Note'),
    );
  if (!node) throw new Error('no title');
  return ([] as unknown[]).concat(node.props.children).join('');
}

const lastPreview = () => mockPreviews[mockPreviews.length - 1];

async function save(text: string) {
  if (!renderer) throw new Error('nothing rendered');
  const input = renderer.root.find(n => (n.type as unknown) === TextInput);
  act(() => input.props.onChangeText(text));
  const button = renderer.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === 'Save Note').length > 0,
    )
    .pop();
  if (!button) throw new Error('no save button');
  await act(async () => {
    await button.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPreviews.length = 0;
  mockNotes.clear();
  mockUnits.models = new Map([['warsh', warsh]]);
  useMushafSettingsStore.setState({rewayah: 'hafs'});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('a saved note', () => {
  it('Hafs: labelled and previewed as before', async () => {
    mockNotes.set('n1', {content: 'a note', rewayahId: 'hafs'});
    await openSheet({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      noteId: 'n1',
    });
    expect(title()).toBe('Edit Note for 2:255');
    expect(lastPreview()).toMatchObject({verseKey: '2:255', text: undefined});
  });

  it('Warsh: named by its anchor in Warsh numbering, previewed as that verse', async () => {
    mockNotes.set('n2', {content: 'a note', rewayahId: 'warsh'});
    await openSheet({
      verseKey: '1:7:5',
      surahNumber: 1,
      ayahNumber: 7,
      noteId: 'n2',
    });
    expect(title()).toBe('Edit Note for 1:7');
    expect(lastPreview()).toMatchObject({
      rewayah: 'warsh',
      text: warsh.unitText(warsh.unitByKey('1:7')!),
    });
  });

  it('Warsh: a legacy row on a merged verse names that verse', async () => {
    mockNotes.set('n3', {content: 'a note', rewayahId: 'warsh'});
    await openSheet({
      verseKey: '103:2',
      surahNumber: 103,
      ayahNumber: 2,
      noteId: 'n3',
    });
    expect(title()).toBe('Edit Note for 103:1');
  });

  it('Warsh units refused: a prefixed Hafs reference, no text', async () => {
    mockUnits.models = new Map();
    mockNotes.set('n4', {content: 'a note', rewayahId: 'warsh'});
    await openSheet({
      verseKey: '1:7:5',
      surahNumber: 1,
      ayahNumber: 7,
      noteId: 'n4',
    });
    expect(title()).toBe('Edit Note for Hafs 1:7');
    expect(lastPreview()).toMatchObject({text: ''});
  });
});

describe('a new note', () => {
  it('Hafs: stored exactly as before', async () => {
    await openSheet({verseKey: '2:255', surahNumber: 2, ayahNumber: 255});
    expect(title()).toBe('Note for 2:255');
    await save('my note');
    expect(verseAnnotationService.addNote).toHaveBeenCalledWith(
      '2:255',
      2,
      255,
      'my note',
      undefined,
      undefined,
    );
  });

  it('Warsh: stored at the verse anchor with its rewayah', async () => {
    await openSheet({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      unitKeys: ['1:7'],
      rewayah: 'warsh',
    });
    expect(title()).toBe('Note for 1:7');
    await save('my note');
    expect(verseAnnotationService.addNote).toHaveBeenCalledWith(
      '1:7:5',
      1,
      7,
      'my note',
      undefined,
      'warsh',
    );
  });
});
