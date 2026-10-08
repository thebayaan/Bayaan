// @ai-generated
/**
 * A verse row of a rewayah (VerseItem with `unitRow`, decision 3): the row is
 * the rewayah's OWN verse. Its pill, text, selection, bookmark / note dots
 * and verse-actions payload follow that verse in the rewayah's numbering;
 * its translations, notes, word by word and reflections come per Hafs verse
 * it holds; the unnumbered Fatiha basmala has no number and no actions.
 * Real slots (the verse-units fixture): Warsh al-Fatihah (Hafs 1:7 split
 * into Warsh 1:6 and 1:7) and al-‘Asr (Warsh 103:1 = Hafs 103:1 + 103:2).
 * Hafs rows: VerseItem.hafsGolden.test.tsx.
 */

import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';

type Props = Record<string, unknown>;

const mockRecorded: {component: string; props: Props}[] = [];
const mockHandlers: {
  onWordPress?: (position: number) => void;
  onFootnotePress?: (id: string, n: string) => void;
} = {};

jest.mock('../SkiaVerseText', () => ({
  __esModule: true,
  default: (props: Props) => {
    mockRecorded.push({component: 'SkiaVerseText', props});
    return null;
  },
}));

jest.mock('../WBWVerseView', () => ({
  WBWVerseView: (props: Props) => {
    mockRecorded.push({component: 'WBWVerseView', props});
    if (!mockHandlers.onWordPress) {
      mockHandlers.onWordPress =
        props.onWordPress as typeof mockHandlers.onWordPress;
    }
    return null;
  },
}));

jest.mock('@/components/mushaf/AyahCommunityReflections', () => ({
  AyahCommunityReflections: (props: Props) => {
    mockRecorded.push({component: 'AyahCommunityReflections', props});
    return null;
  },
}));

jest.mock('@/components/utils/FormattedText', () => {
  const {Text} = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: (props: {
      text: string;
      onFootnotePress?: (id: string, n: string) => void;
    }) => {
      if (props.onFootnotePress && !mockHandlers.onFootnotePress) {
        mockHandlers.onFootnotePress = props.onFootnotePress;
      }
      return ReactActual.createElement(
        Text,
        {testID: 'formatted-text'},
        props.text,
      );
    },
  };
});

jest.mock('@expo/vector-icons', () => {
  const {Text} = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  const icon = (family: string) => (props: {name: string}) =>
    ReactActual.createElement(Text, null, `${family}:${props.name}`);
  return {Feather: icon('Feather'), Ionicons: icon('Ionicons')};
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: {isDarkMode: false}, isDarkMode: false}),
}));

const mockSheetShow = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockSheetShow(...args)},
}));

const mockHaptics = jest.fn();
jest.mock('@/utils/haptics', () => ({mediumHaptics: () => mockHaptics()}));

const mockFootnoteLookups: string[] = [];
jest.mock('@/utils/translationLookup', () => ({
  isBundledTranslation: () => true,
  getBundledFootnotes: (verseKey: string) => {
    mockFootnoteLookups.push(verseKey);
    return {'77': `FOOTNOTE-OF-${verseKey}`};
  },
}));

jest.mock('@/store/tajweedStore', () => {
  const {create} = jest.requireActual('zustand');
  return {useTajweedStore: create(() => ({indexedTajweedData: null}))};
});

jest.mock('@/store/verseAnnotationsStore', () => {
  const {create} = jest.requireActual('zustand');
  return {
    useVerseAnnotationsStore: create(() => ({
      bookmarkedVerseKeys: new Set<string>(),
      notedVerseKeys: new Set<string>(),
    })),
  };
});

import {VerseItem} from '../VerseItem';
import {
  buildVerseUnitRows,
  UNNUMBERED_BASMALA_ROW_KEY,
  type VerseUnitRow,
} from '../verseUnitRows';
import {fixtureUnits} from '../__fixtures__/verseUnitsFixtures';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useVerseSelectionStore} from '@/store/verseSelectionStore';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import type {SkTypefaceFontProvider} from '@shopify/react-native-skia';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const FONT_MGR = {fake: 'fontMgr'} as unknown as SkTypefaceFontProvider;
// Placeholder Hafs-aligned content (a footnote on every translation).
const content = (hafsKey: string) => ({
  translation: `T(${hafsKey})<sup foot_note="77">1</sup>`,
  transliteration: `TL(${hafsKey})`,
});
const fatihah = buildVerseUnitRows(fixtureUnits('warsh'), 1, content);
const asr = buildVerseUnitRows(fixtureUnits('warsh'), 103, content);
const row = (rows: VerseUnitRow[], key: string) =>
  rows.find(r => r.verse_key === key)!;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(unitRow: VerseUnitRow, props: Props = {}) {
  act(() => {
    renderer = TestRenderer.create(
      <VerseItem
        verse={unitRow}
        unitRow={unitRow}
        onVersePress={() => undefined}
        textColor="#111111"
        borderColor="#cccccc"
        showTajweed={false}
        arabicFontFamily="Uthmani"
        transliterationFontSize={14}
        translationFontSize={15}
        arabicFontSize={24}
        fontMgr={FONT_MGR}
        dkFontFamily="DigitalKhattV2"
        indexedTajweedData={null}
        rewayah="warsh"
        {...(props as object)}
      />,
    );
  });
  return renderer!;
}

const measure = (r: TestRenderer.ReactTestRenderer) => {
  const target = r.root.findAll(
    n => typeof n.type === 'string' && typeof n.props.onLayout === 'function',
  )[0];
  act(() => target?.props.onLayout({nativeEvent: {layout: {width: 320}}}));
};

const rowPressable = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n =>
      typeof n.type !== 'string' && typeof n.props.onLongPress === 'function',
  )[0];

const optionsButton = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      n.props.hitSlop !== undefined,
  )[0];

/** Every string rendered, in order. */
function texts(r: TestRenderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as {children: unknown}).children);
    }
  };
  walk(r.toJSON());
  return out;
}

/** The strings under the row's header (pill, dots, options button). */
const body = (r: TestRenderer.ReactTestRenderer) => {
  const all = texts(r);
  return all.slice(all.indexOf('Feather:more-horizontal') + 1);
};

const formatted = (r: TestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(
      n => typeof n.type === 'string' && n.props.testID === 'formatted-text',
    )
    .map(n => n.props.children);

const recorded = (component: string) =>
  mockRecorded.filter(r => r.component === component).map(r => r.props);
const last = (component: string) => {
  const list = recorded(component);
  return list[list.length - 1];
};

beforeEach(() => {
  mockRecorded.length = 0;
  mockSheetShow.mockClear();
  mockHaptics.mockClear();
  mockFootnoteLookups.length = 0;
  mockHandlers.onWordPress = undefined;
  mockHandlers.onFootnotePress = undefined;
  useMushafSettingsStore.setState({
    rewayah: 'hafs',
    mushafRenderer: 'dk_v2',
    arabicTextWeight: 'normal',
    showAllahNameHighlight: false,
  });
  useVerseSelectionStore.getState().clearSelection();
  useVerseAnnotationsStore.setState({
    bookmarkedVerseKeys: new Set(),
    notedVerseKeys: new Set(),
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('the row is the rewayah verse', () => {
  it('Warsh 1:6: its own label and exactly its own slots', () => {
    const v6 = row(fatihah, '1:6');
    const r = render(v6);
    measure(r);
    expect(texts(r)[0] + texts(r)[1] + texts(r)[2]).toBe('1:6');
    const skia = last('SkiaVerseText');
    expect(skia.words).toBe(v6.words);
    expect(skia.rewayah).toBe('warsh');
    expect(skia.verseKey).toBe('1:6');
    // Drawn from its words only: never the Hafs verse's (1:7) words.
    expect(skia.text).toBeUndefined();
  });

  it('a Warsh row never shows Hafs (QPC) text, even in a Hafs mushaf context', () => {
    // No rewayah prop and a Hafs mushaf: the row's own rewayah decides.
    const r = render(row(fatihah, '1:1'), {rewayah: undefined, fontMgr: null});
    expect(
      r.root.findAll(n => n.props.testID === 'verse-text-placeholder').length,
    ).toBeGreaterThan(0);
    expect(recorded('SkiaVerseText')).toHaveLength(0);
  });
});

describe('selection and verse actions act on the rewayah verse', () => {
  const v6Payload = {
    verseKey: '1:7',
    surahNumber: 1,
    ayahNumber: 7,
    source: 'player',
    rewayah: 'warsh',
    unitKeys: ['1:6'],
  };

  it('long press selects Warsh 1:6 in its numbering and opens its actions', () => {
    const r = render(row(fatihah, '1:6'));
    act(() => rowPressable(r).props.onLongPress());
    expect(mockHaptics).toHaveBeenCalledTimes(1);
    const sel = useVerseSelectionStore.getState();
    expect([
      sel.selectedVerseKey,
      sel.selectedSurahNumber,
      sel.selectedAyahNumber,
      sel.selectedRewayah,
    ]).toEqual(['1:6', 1, 6, 'warsh']);
    expect(mockSheetShow.mock.calls).toEqual([
      ['verse-actions', {payload: v6Payload}],
    ]);
  });

  it('the options button opens the same actions (no haptics)', () => {
    const r = render(row(fatihah, '1:6'), {source: 'mushaf'});
    act(() => optionsButton(r).props.onPress());
    expect(mockHaptics).not.toHaveBeenCalled();
    expect(mockSheetShow.mock.calls).toEqual([
      ['verse-actions', {payload: {...v6Payload, source: 'mushaf'}}],
    ]);
  });

  it('the second part of a split Hafs verse: its own unit and Hafs fields', () => {
    const r = render(row(fatihah, '1:7'));
    act(() => rowPressable(r).props.onLongPress());
    expect(mockSheetShow.mock.calls[0][1]).toEqual({
      payload: {...v6Payload, unitKeys: ['1:7']},
    });
  });

  it('a merged verse names every Hafs verse it holds', () => {
    const r = render(row(asr, '103:1'));
    act(() => rowPressable(r).props.onLongPress());
    expect(mockSheetShow.mock.calls[0][1]).toEqual({
      payload: {
        verseKey: '103:1',
        surahNumber: 103,
        ayahNumber: 1,
        verseKeys: ['103:1', '103:2'],
        source: 'player',
        rewayah: 'warsh',
        unitKeys: ['103:1'],
      },
    });
  });

  it('a selected key counts only in its own numbering', () => {
    const styleOf = (r: TestRenderer.ReactTestRenderer) =>
      JSON.stringify(rowPressable(r).props.style);
    const r = render(row(fatihah, '1:6'));
    const idle = styleOf(r);
    // Hafs 1:6 selected (e.g. by a Hafs list): not this Warsh verse.
    act(() => useVerseSelectionStore.getState().selectVerse('1:6', 1, 6));
    expect(styleOf(r)).toBe(idle);
    act(() =>
      useVerseSelectionStore.getState().selectVerse('1:6', 1, 6, 'warsh'),
    );
    expect(styleOf(r)).not.toBe(idle);
  });
});

describe('bookmark and note dots from the stored Hafs anchors', () => {
  it('a row stored at Warsh 1:7 (anchor 1:7:5) marks Warsh 1:7 only', () => {
    useVerseAnnotationsStore.setState({
      bookmarkedVerseKeys: new Set(['1:7:5']),
    });
    let r = render(row(fatihah, '1:7'));
    expect(texts(r)).toContain('Feather:bookmark');
    act(() => r.unmount());
    r = render(row(fatihah, '1:6'));
    expect(texts(r)).not.toContain('Feather:bookmark');
  });

  it('a row at Hafs 1:7 marks Warsh 1:6, which starts it', () => {
    useVerseAnnotationsStore.setState({notedVerseKeys: new Set(['1:7'])});
    const r = render(row(fatihah, '1:6'));
    expect(texts(r)).toContain('Feather:file-text');
  });

  it('a legacy row on Hafs 103:2 marks the merged Warsh 103:1', () => {
    useVerseAnnotationsStore.setState({
      bookmarkedVerseKeys: new Set(['103:2']),
    });
    const r = render(row(asr, '103:1'));
    expect(texts(r)).toContain('Feather:bookmark');
  });
});

describe('Hafs-aligned content per Hafs verse', () => {
  it('Hafs 1:7: its translation once under Warsh 1:6, the note under both', () => {
    const note =
      'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';
    let r = render(row(fatihah, '1:6'), {
      showTranslation: true,
      showTransliteration: true,
      translationName: 'Saheeh International',
    });
    expect(body(r)).toEqual([
      'T(1:7)<sup foot_note="77">1</sup>',
      note,
      'Saheeh International',
    ]);
    act(() => r.unmount());
    r = render(row(fatihah, '1:7'), {
      showTranslation: true,
      showTransliteration: true,
    });
    // No translation (it is under 1:6), no source line: only the note.
    expect(body(r)).toEqual([note]);
  });

  it('a merged verse shows both Hafs translations, in order', () => {
    const r = render(row(asr, '103:1'), {showTranslation: true});
    expect(formatted(r)).toEqual([
      'T(103:1)<sup foot_note="77">1</sup>',
      'T(103:2)<sup foot_note="77">1</sup>',
    ]);
  });

  it('never shows the Hafs transliteration under the rewayah verse', () => {
    const r = render(row(asr, '103:1'), {showTransliteration: true});
    expect(texts(r).some(t => t.startsWith('TL('))).toBe(false);
  });

  it('a footnote opens from its own Hafs verse', () => {
    const r = render(row(fatihah, '1:6'), {showTranslation: true});
    act(() => mockHandlers.onFootnotePress?.('77', '1'));
    expect(mockFootnoteLookups).toEqual(['1:7']);
    expect(texts(r)).toContain('FOOTNOTE-OF-1:7');
  });

  it('reflections of each Hafs verse the row owns, once in the list', () => {
    render(row(asr, '103:1'));
    expect(
      recorded('AyahCommunityReflections').map(p => [
        p.surahNumber,
        p.ayahNumber,
      ]),
    ).toEqual([
      [103, 1],
      [103, 2],
    ]);
    mockRecorded.length = 0;
    act(() => renderer!.unmount());
    // Warsh 103:3 holds the end of Hafs 103:3, which Warsh 103:2 owns.
    render(row(asr, '103:3'));
    expect(recorded('AyahCommunityReflections')).toEqual([]);
    mockRecorded.length = 0;
    act(() => renderer!.unmount());
    // Never the Hafs verse that merely shares the number (Hafs 1:6).
    render(row(fatihah, '1:6'));
    expect(
      recorded('AyahCommunityReflections').map(p => [
        p.surahNumber,
        p.ayahNumber,
      ]),
    ).toEqual([[1, 7]]);
  });
});

describe('word by word: a Hafs grid per Hafs verse, cut to the row', () => {
  it('Warsh 1:6 shows Hafs 1:7 words 1-4, named as Hafs', () => {
    render(row(fatihah, '1:6'), {showWBW: true});
    const grids = recorded('WBWVerseView');
    expect(
      grids.map(p => [p.verseKey, p.wordRange, p.hafsNotice, p.rewayah]),
    ).toEqual([
      ['1:7', {first: 1, last: 4}, 'Word-by-word shown in Hafs 1:7', 'warsh'],
    ]);
  });

  it('a merged verse: two whole Hafs grids', () => {
    render(row(asr, '103:1'), {showWBW: true});
    expect(
      recorded('WBWVerseView').map(p => [p.verseKey, p.wordRange]),
    ).toEqual([
      ['103:1', undefined],
      ['103:2', undefined],
    ]);
  });

  it('a word opens the word detail of its Hafs verse', () => {
    // The sheet stays open: the word stays highlighted.
    mockSheetShow.mockImplementationOnce(() => new Promise(() => undefined));
    render(row(fatihah, '1:7'), {showWBW: true});
    act(() => mockHandlers.onWordPress?.(6));
    expect(mockSheetShow.mock.calls).toEqual([
      ['word-detail', {payload: {verseKey: '1:7', position: 6}}],
    ]);
    expect(last('WBWVerseView').selectedWordPosition).toBe(6);
  });
});

describe('the unnumbered Fatiha basmala (Madani count)', () => {
  const basmala = fatihah[0];

  it('is drawn with its translation, without a number or actions', () => {
    expect(basmala.verse_key).toBe(UNNUMBERED_BASMALA_ROW_KEY);
    const r = render(basmala, {showTranslation: true});
    measure(r);
    const shown = texts(r);
    expect(shown).not.toContain('Feather:more-horizontal');
    expect(shown.some(t => /^\d+$/.test(t))).toBe(false);
    expect(shown[0]).toBe('T(1:1)<sup foot_note="77">1</sup>');
    const skia = last('SkiaVerseText');
    expect(skia.words).toBe(basmala.words);
    expect(skia.verseKey).toBeUndefined();
    act(() => rowPressable(r).props.onLongPress());
    expect(mockSheetShow).not.toHaveBeenCalled();
    expect(mockHaptics).not.toHaveBeenCalled();
    expect(useVerseSelectionStore.getState().selectedVerseKey).toBeNull();
  });
});
