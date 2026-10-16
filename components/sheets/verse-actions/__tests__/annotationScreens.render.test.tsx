// @ai-generated
/**
 * The verse actions sheet's Highlight and Add Note screens on a verse of
 * another rewayah (decision 3; verse-units contract section 3): the current
 * colour and Remove Highlight read every row that marks the verse (legacy
 * rows keyed by a Hafs verse it holds included), a colour is written at
 * each verse's anchor, and a note on several verses stores every verse's
 * anchor. Hafs reads and writes the Hafs keys, as before.
 *
 * Real Warsh slots (verseUnitsFixture.json: Warsh 1:6 = Hafs 1:7 words 1-4,
 * 1:7 = the rest of Hafs 1:7, 103:1 = Hafs 103:1 + 103:2); the real
 * annotations store with the database service mocked; rows are saved in
 * Warsh unless a test says otherwise.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {TextInput} from 'react-native';

jest.mock('@/components/share/SkiaVersePreview', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: (props: {name: string}) => {
    const {Text} = jest.requireActual('react-native');
    const ReactActual = jest.requireActual('react');
    return ReactActual.createElement(Text, null, `icon:${props.name}`);
  },
}));
jest.mock('react-native-actions-sheet', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    ScrollView: (props: {children?: React.ReactNode}) =>
      ReactActual.createElement(View, null, props.children),
  };
});
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
    },
    isDarkMode: false,
  }),
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {
    upsertHighlight: jest.fn(async () => undefined),
    removeHighlight: jest.fn(async () => undefined),
    addNote: jest.fn(async () => undefined),
    applyAnnotationChanges: jest.fn(async () => undefined),
    getAnnotationsForSurah: jest.fn(async () => ({
      bookmarks: [],
      notes: [],
      highlights: [],
    })),
  },
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null, status: () => 'error'}),
}));

import {HighlightContent} from '../HighlightContent';
import {NoteContent} from '../NoteContent';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {HIGHLIGHT_COLORS, type HighlightColor} from '@/types/verse-annotations';
import {setStoredRows} from '../__fixtures__/storedRows';
import {
  selectVerses,
  unitSelection,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
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
const warshSelection = (...keys: string[]): ReadyVerseSelection =>
  unitSelection(
    warsh,
    keys.map(key => warsh.unitByKey(key)!),
  );
function hafsSelection(key: string): ReadyVerseSelection {
  const [s, a] = key.split(':').map(Number);
  const selection = selectVerses(
    {rewayah: 'hafs', verseKey: key, surahNumber: s, ayahNumber: a},
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error('not ready');
  return selection;
}

const service = verseAnnotationService as jest.Mocked<
  typeof verseAnnotationService
>;
const onDone = jest.fn();
let renderer: TestRenderer.ReactTestRenderer | null = null;

async function render(element: Parameters<typeof TestRenderer.create>[0]) {
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
}

/** The colour swatch pressable of `color`. */
function swatch(color: HighlightColor): TestRenderer.ReactTestInstance {
  const hex = HIGHLIGHT_COLORS[color];
  const found = renderer!.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      ([] as unknown[])
        .concat(n.props.style)
        .flat()
        .some(
          s =>
            !!s &&
            typeof s === 'object' &&
            (s as {backgroundColor?: string}).backgroundColor === hex,
        ),
  );
  if (found.length === 0) throw new Error(`no swatch ${color}`);
  return found[0];
}

/** Colours drawn with a check mark (the current colour). */
function activeColors(): HighlightColor[] {
  return (Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).filter(
    color =>
      swatch(color).findAll(n => n.props.children === 'icon:check').length > 0,
  );
}

function hasText(text: string): boolean {
  return renderer!.root.findAll(n => n.props.children === text).length > 0;
}

async function pressNode(node: TestRenderer.ReactTestInstance) {
  await act(async () => {
    await node.props.onPress();
  });
}

async function pressText(text: string) {
  const target = renderer!.root
    .findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === text).length > 0,
    )
    .pop();
  if (!target) throw new Error(`nothing to press for ${text}`);
  await pressNode(target);
}

beforeEach(() => {
  jest.clearAllMocks();
  setStoredRows([]);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('Highlight screen', () => {
  it('a legacy row on a Hafs verse the verse holds is its colour; Remove deletes it', async () => {
    setStoredRows([], {'103:2': 'yellow'});
    await render(
      <HighlightContent selection={warshSelection('103:1')} onDone={onDone} />,
    );
    expect(activeColors()).toEqual(['yellow']);
    expect(hasText('Remove Highlight')).toBe(true);
    await pressText('Remove Highlight');
    // One transaction deleting the row that marks the verse.
    expect(service.applyAnnotationChanges.mock.calls).toEqual([
      [{removeHighlights: ['103:2']}],
    ]);
    expect(onDone).toHaveBeenCalled();
  });

  it('a write that fails still closes the screen, colour or remove', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    service.applyAnnotationChanges.mockRejectedValueOnce(new Error('disk'));
    await render(
      <HighlightContent selection={warshSelection('1:6')} onDone={onDone} />,
    );
    await pressNode(swatch('green'));
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => renderer?.unmount());
    setStoredRows([], {'1:7:1': 'green'});
    service.applyAnnotationChanges.mockRejectedValueOnce(new Error('disk'));
    await render(
      <HighlightContent selection={warshSelection('1:6')} onDone={onDone} />,
    );
    await pressText('Remove Highlight');
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('a colour is written at every selected verse anchor', async () => {
    await render(
      <HighlightContent
        selection={warshSelection('1:6', '1:7')}
        onDone={onDone}
      />,
    );
    expect(activeColors()).toEqual([]);
    expect(hasText('Remove Highlight')).toBe(false);
    await pressNode(swatch('green'));
    const row = (verseKey: string) => ({
      verseKey,
      surahNumber: 1,
      ayahNumber: 7,
      color: 'green',
      rewayahId: 'warsh',
    });
    expect(service.applyAnnotationChanges.mock.calls).toEqual([
      [{upsertHighlights: [row('1:7:1'), row('1:7:5')]}],
    ]);
  });

  it('Hafs: the Hafs key, as before', async () => {
    setStoredRows([], {'2:255': 'blue'}, 'hafs');
    await render(
      <HighlightContent selection={hafsSelection('2:255')} onDone={onDone} />,
    );
    expect(activeColors()).toEqual(['blue']);
    await pressNode(swatch('purple'));
    expect(service.upsertHighlight.mock.calls).toEqual([
      ['2:255', 2, 255, 'purple', 'hafs'],
    ]);
  });
});

describe('Add Note screen', () => {
  async function saveNote(text: string) {
    const input = renderer!.root.find(n => (n.type as unknown) === TextInput);
    act(() => input.props.onChangeText(text));
    await pressText('Save Note');
  }

  it('a note on several verses stores every verse anchor', async () => {
    await render(
      <NoteContent selection={warshSelection('1:6', '1:7')} onDone={onDone} />,
    );
    await saveNote(' my note ');
    expect(service.addNote.mock.calls).toEqual([
      ['1:7:1', 1, 7, 'my note', ['1:7:1', '1:7:5'], 'warsh'],
    ]);
    expect(onDone).toHaveBeenCalled();
  });

  it('Hafs: the Hafs key, as before', async () => {
    await render(
      <NoteContent selection={hafsSelection('2:255')} onDone={onDone} />,
    );
    await saveNote('my note');
    expect(service.addNote.mock.calls).toEqual([
      ['2:255', 2, 255, 'my note', undefined, 'hafs'],
    ]);
  });
});
