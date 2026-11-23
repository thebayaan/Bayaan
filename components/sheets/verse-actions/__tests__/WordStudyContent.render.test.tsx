// @ai-generated
/**
 * The Word Study screen (WordStudyContent.tsx) over the real Hafs slots of
 * the verse-units fixture and the real Warsh verse units: the grid of the
 * current verse, the step bar across verses in the Quran's direction, the
 * verse chips, whole-verse mode, the books tab loaded when it opens, the
 * loading and error states, scrolling back to the card after a step, the
 * VoiceOver announcement, and the arrow keys on iPad. The grid and the card
 * are recorders; the word-by-word words are placeholders, one per slot.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import type {DKWordInfo} from '@/services/mushaf/DigitalKhattDataService';
import type {WBWWord} from '@/services/wbw/WBWDataService';

const mockRecorded: Record<string, Record<string, unknown>[]> = {};
function mockRecord(name: string, props: Record<string, unknown>) {
  (mockRecorded[name] ??= []).push(props);
  return null;
}
const mockScroll: {calls: unknown[]} = {calls: []};
const mockDk = {words: new Map<string, DKWordInfo[]>()};
const mockWbw = new Map<string, WBWWord[]>();

jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({
    WBWVerseView: (props: Record<string, unknown>) => mockRecord('grid', props),
  }),
);
jest.mock('../WordCard', () => ({
  DEFAULT_CARD_SECTIONS: {irab: true, morphology: true, morphologyMore: false},
  WordCard: (props: Record<string, unknown>) => mockRecord('card', props),
  CompactWordCard: (props: Record<string, unknown>) =>
    mockRecord('compact', props),
}));
jest.mock('../sheetGestures', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    SheetScrollView: ReactActual.forwardRef(
      (
        props: {children?: React.ReactNode; onScroll?: unknown},
        ref: unknown,
      ) => {
        ReactActual.useImperativeHandle(ref, () => ({
          scrollTo: (options: unknown) => mockScroll.calls.push(options),
        }));
        return ReactActual.createElement(
          View,
          {testID: 'scroll', onScroll: props.onScroll},
          props.children,
        );
      },
    ),
    SheetFooter: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, {...props, testID: 'step-bar'}),
  };
});
jest.mock('react-native-reanimated', () => ({useReducedMotion: () => false}));
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        background: '#ffffff',
        primary: '#0a7d5a',
      },
    },
  }),
}));
jest.mock('@/modules/bayaan-keyboard', () => ({
  BayaanKeyboard: {
    isAvailable: true,
    setCommands: jest.fn(),
    addKeyCommandListener: jest.fn(() => () => undefined),
  },
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: true},
}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    initialized: true,
    isRewayahReady: () => true,
    ensureRewayahLoaded: jest.fn(async () => undefined),
    subscribeCacheChanges: () => () => undefined,
    tryGetVerseWords: (key: string) => mockDk.words.get(key) ?? [],
  },
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {},
}));
jest.mock('@/services/wbw/WBWDataService', () => ({
  wbwDataService: {
    initialize: jest.fn(async () => undefined),
    getVerseWords: jest.fn(async (key: string) => mockWbw.get(key) ?? []),
  },
}));
jest.mock('@/services/irab/IrabDataService', () => ({
  irabDataService: {
    getVerse: jest.fn(async (key: string) =>
      (mockWbw.get(key) ?? []).map(w => ({
        position: w.position,
        entries: [],
        agreed: false,
        morph: [],
      })),
    ),
    getBooks: jest.fn(async () => []),
  },
}));
jest.mock('@/services/wordStudy/WordStudyDataService', () => ({
  wordStudyDataService: {
    getVerse: jest.fn(async (verseKey: string) => ({
      verseKey,
      gharib: [],
      rasm: [],
    })),
  },
}));
jest.mock('@/services/mushaf/WordReadingsService', () => ({
  wordReadingsService: {request: jest.fn(async () => null)},
}));

import {wbwDataService} from '@/services/wbw/WBWDataService';
import {irabDataService} from '@/services/irab/IrabDataService';
import {wordReadingsService} from '@/services/mushaf/WordReadingsService';
import {wordStudyDataService} from '@/services/wordStudy/WordStudyDataService';
import {
  buildRewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import {
  selectVerses,
  unitSelection,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
import {
  addKeyLayer,
  pressKeyForTests,
  resetKeyCommandsForTests,
} from '@/services/keyboard/keyCommands';
import {WordStudyContent} from '../WordStudyContent';
import {verticalScale} from '@/utils/scale';
import type {WordRef} from '../wordStudy';
// @ai-start
import {
  hafsVerseWordParts,
  selectionWordParts,
  type WordStudySubject,
} from '../verseUnitScreens';
// @ai-end

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: {hafs: string[]; warsh: string[]};
  };

/** The Hafs slots of every fixture verse, and one placeholder word each. */
function loadFixtureWords() {
  fixture.locations.forEach((location, i) => {
    const [s, a, w] = location.split(':');
    const verseKey = `${s}:${a}`;
    const slots = mockDk.words.get(verseKey) ?? [];
    slots.push({
      text: fixture.texts.hafs[i],
      verseKey,
      wordPositionInVerse: Number(w),
    });
    mockDk.words.set(verseKey, slots);
  });
  for (const [verseKey, slots] of mockDk.words) {
    mockWbw.set(
      verseKey,
      slots
        .filter(slot => !slot.text.startsWith('۝'))
        .map((slot, i) => ({
          position: i + 1,
          textUthmani: slot.text,
          translation: `T${verseKey}:${i + 1}`,
          transliteration: '',
          audioUrl: '',
        })),
    );
  }
}
loadFixtureWords();

const warsh = buildRewayahVerseUnits(
  'warsh',
  fixture.ids.map((id, i): VerseUnitSlot => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts.warsh[i]};
  }),
  'warsh@test',
);

// @ai-start
/** A selection's words, as the verse actions sheet gives them. */
function studyOf(selection: ReadyVerseSelection): WordStudySubject {
  return {rewayah: selection.rewayah, parts: selectionWordParts(selection)};
}
// @ai-end

function hafs(...verseKeys: string[]): WordStudySubject {
  const [surahNumber, ayahNumber] = verseKeys[0].split(':').map(Number);
  const selection = selectVerses(
    {
      rewayah: 'hafs',
      verseKey: verseKeys[0],
      surahNumber,
      ayahNumber,
      verseKeys: verseKeys.length > 1 ? verseKeys : undefined,
    },
    null,
    'ready',
  );
  if (selection.status !== 'ready') throw new Error('not ready');
  return studyOf(selection); // @ai
}

function warshVerses(...keys: string[]): WordStudySubject {
  return studyOf(
    unitSelection(
      warsh,
      keys.map(key => {
        const unit = warsh.unitByKey(key);
        if (!unit) throw new Error(`no Warsh ${key}`);
        return unit;
      }),
    ),
  );
}

// @ai-start
/**
 * Warsh's unnumbered Fatiha basmala (no verse of Warsh), as the sheet's
 * Word Study only mode gives it: the words of Hafs 1:1.
 */
function warshBasmala(): WordStudySubject {
  return {rewayah: 'warsh', parts: hafsVerseWordParts(['1:1'], 'warsh')};
}
// @ai-end

let renderer: TestRenderer.ReactTestRenderer | null = null;

function root(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function open(
  study: WordStudySubject, // @ai
  initialWord?: WordRef,
): Promise<void> {
  if (renderer) act(() => renderer?.unmount());
  act(() => {
    renderer = TestRenderer.create(
      <WordStudyContent study={study} initialWord={initialWord} />, // @ai
    );
  });
  await settle();
}

const last = (name: string) => {
  const calls = mockRecorded[name] ?? [];
  return calls[calls.length - 1];
};

/** Every string drawn in a Text. */
function texts(): string[] {
  return root()
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

/** The host views with this accessibility role. */
function withRole(role: string): TestRenderer.ReactTestInstance[] {
  return root().findAll(
    n => typeof n.type === 'string' && n.props.accessibilityRole === role,
  );
}

/** The pressable with this label or text, last match. */
function control(label: string): TestRenderer.ReactTestInstance {
  const found = root().findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityRole === 'string' &&
      (n.props.accessibilityLabel === label ||
        n.findAll(c => c.props.children === label).length > 0),
  );
  if (found.length === 0) throw new Error(`nothing to press for ${label}`);
  return found[found.length - 1];
}

async function press(label: string) {
  const target = control(label);
  await act(async () => {
    target.props.onPress();
  });
}

const card = () => last('card') as {word: {verseKey: string; position: number}};
const cardWord = () => `${card().word.verseKey}:${card().word.position}`;

beforeEach(() => {
  for (const key of Object.keys(mockRecorded)) delete mockRecorded[key];
  mockScroll.calls = [];
  jest.clearAllMocks();
  resetKeyCommandsForTests(false);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe('one Hafs verse (1:4)', () => {
  it('opens on the first word, with the grid selecting on tap', async () => {
    await open(hafs('1:4'));
    expect(last('grid')).toMatchObject({
      verseKey: '1:4',
      wordRange: undefined,
      rewayah: 'hafs',
      selectOnTap: true,
      showTranslation: false,
      showTransliteration: false,
      selectedWordPosition: 1,
    });
    expect(cardWord()).toBe('1:4:1');
    expect(texts()).toContain('Word 1 of 3');
    // A single verse: the two tabs, no chips, no caption.
    expect(withRole('tab')).toHaveLength(2);
    expect(texts()).not.toContain('1:4');
  });

  it('keeps the step bar a sheet footer, spaced as the other footers', async () => {
    await open(hafs('1:4'));
    // The sheet never starts a drag from the bar (sheetGestures.tsx), so a
    // tap on Previous or Next that wobbles is still a tap.
    const bar = root().find(
      n => typeof n.type === 'string' && n.props.testID === 'step-bar',
    );
    expect(
      bar.findAll(
        n => (n.type as unknown) === Text && n.props.children === 'Word 1 of 3',
      ),
    ).toHaveLength(1);
    for (const label of ['Previous word', 'Next word']) {
      expect(
        bar.findAll(n => n.props.accessibilityLabel === label).length,
      ).toBeGreaterThan(0);
    }
    // The same space above and below the 44pt buttons as the Translation
    // and Tafsir footers; the sheet's bottom padding and inset come under.
    const style = StyleSheet.flatten(bar.props.style);
    expect(style.paddingTop).toBe(verticalScale(12));
    expect(style.paddingBottom).toBe(verticalScale(18));
  });

  it('steps with Next and Previous, disabled at either end', async () => {
    await open(hafs('1:4'));
    expect(control('Previous word').props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(control('Next word').props.accessibilityRole).toBe('button');
    await press('Next word');
    expect(cardWord()).toBe('1:4:2');
    expect(last('grid').selectedWordPosition).toBe(2);
    expect(texts()).toContain('Word 2 of 3');
    await press('Next word');
    expect(control('Next word').props.accessibilityState).toEqual({
      disabled: true,
    });
    await press('Previous word');
    expect(cardWord()).toBe('1:4:2');
    // The verse's gharib and rasm were read once, not once per word.
    expect(wordStudyDataService.getVerse).toHaveBeenCalledTimes(1);
  });

  it('opens on the word it was given', async () => {
    await open(hafs('1:4'), {verseKey: '1:4', position: 3});
    expect(cardWord()).toBe('1:4:3');
    expect(texts()).toContain('Word 3 of 3');
  });

  it('opens on the first word when the given one is not in the selection', async () => {
    await open(hafs('1:4'), {verseKey: '2:255', position: 3});
    expect(cardWord()).toBe('1:4:1');
    await press('Next word');
    expect(cardWord()).toBe('1:4:2');
  });

  it('a tap in the grid selects that word', async () => {
    await open(hafs('1:4'));
    const onWordPress = last('grid').onWordPress as (p: number) => void;
    act(() => onWordPress(3));
    expect(cardWord()).toBe('1:4:3');
  });

  it('gives the card the word, its slots, data and quoting helpers', async () => {
    await open(hafs('1:4'), {verseKey: '1:4', position: 2});
    const props = last('card') as Record<string, unknown>;
    expect(props).toMatchObject({
      rewayah: 'hafs',
      wbw: {position: 2, translation: 'T1:4:2'},
      irab: {position: 2},
      slots: [mockDk.words.get('1:4')?.[1]],
      study: {verseKey: '1:4', gharib: [], rasm: []},
    });
    expect(wordStudyDataService.getVerse).toHaveBeenCalledWith('1:4');
    const wordTextOf = props.wordTextOf as (v: string, p: number) => unknown;
    expect(wordTextOf('1:4', 3)).toBe(mockDk.words.get('1:4')?.[2].text);
    expect(props.onRootPress).toBeUndefined();
  });

  it('announces the word after a step', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    await open(hafs('1:4'));
    await press('Next word');
    const word = mockDk.words.get('1:4')?.[1].text;
    expect(announce).toHaveBeenCalledWith(`${word}, word 2 of 3`);
    announce.mockRestore();
  });

  it('scrolls back to the card after a step, not after a tap', async () => {
    await open(hafs('1:4'));
    const scroller = root().findByProps({testID: 'scroll'});
    const cardBox = root().find(
      n =>
        typeof n.props.onLayout === 'function' && n.props.testID !== 'scroll',
    );
    act(() => cardBox.props.onLayout({nativeEvent: {layout: {y: 300}}}));
    act(() =>
      scroller.props.onScroll({nativeEvent: {contentOffset: {y: 520}}}),
    );
    const onWordPress = last('grid').onWordPress as (p: number) => void;
    act(() => onWordPress(2));
    expect(mockScroll.calls).toEqual([]);
    await press('Next word');
    expect(mockScroll.calls).toEqual([{y: 292, animated: true}]);
    // The card in view: no scroll.
    act(() =>
      scroller.props.onScroll({nativeEvent: {contentOffset: {y: 100}}}),
    );
    await press('Previous word');
    expect(mockScroll.calls).toHaveLength(1);
  });

  it('whole-verse mode lists the words; one opens one-word mode', async () => {
    await open(hafs('1:4'));
    await press('Whole verse');
    const listed = (mockRecorded.compact ?? []).slice(-3);
    expect(listed.map(p => (p.word as {position: number}).position)).toEqual([
      1, 2, 3,
    ]);
    expect(last('grid').selectedWordPosition).toBeNull();
    // No step bar in whole-verse mode.
    expect(() => control('Next word')).toThrow();
    const onStudy = last('compact').onStudy as (w: unknown) => void;
    mockRecorded.card = [];
    act(() => onStudy(listed[1].word));
    expect(cardWord()).toBe('1:4:2');
    // Back in one-word mode: the pill offers the whole verse again.
    expect(texts()).toContain('Whole verse');
  });

  it('a grid tap in whole-verse mode opens that word', async () => {
    await open(hafs('1:4'));
    await press('Whole verse');
    const onWordPress = last('grid').onWordPress as (p: number) => void;
    act(() => onWordPress(3));
    expect(cardWord()).toBe('1:4:3');
    expect(texts()).toContain('Whole verse');
  });

  it('loads the books only when their tab opens', async () => {
    await open(hafs('1:4'));
    expect(irabDataService.getBooks).not.toHaveBeenCalled();
    expect(
      withRole('tab').map(t => t.props.accessibilityState.selected),
    ).toEqual([true, false]);
    await press("I'rab books");
    await settle();
    expect(irabDataService.getBooks).toHaveBeenCalledWith('1:4');
    expect(texts()).toContain('These books have no passage for this verse.');
    expect(() => control('Next word')).toThrow();
  });

  it('shows a book page that discusses several verses once, captioned with all of them', async () => {
    const page = (id: number, text: string) => ({
      bookId: 1,
      nameAr: 'كتاب',
      authorAr: 'مؤلف',
      passages: [{id, text, part: '1', page: `${id}`}],
    });
    // 1:6 and 1:7 are on one page of the book; 1:7 has a page of its own.
    (irabDataService.getBooks as jest.Mock)
      .mockImplementationOnce(async () => [page(10, 'نص مشترك')])
      .mockImplementationOnce(async () => [
        {
          ...page(10, 'نص مشترك'),
          passages: [
            ...page(10, 'نص مشترك').passages,
            ...page(11, 'نص خاص').passages,
          ],
        },
      ]);
    await open(hafs('1:6', '1:7'));
    await press("I'rab books");
    await settle();
    const shown = texts();
    expect(shown.filter(t => t === 'نص مشترك')).toHaveLength(1);
    expect(shown.filter(t => t === 'نص خاص')).toHaveLength(1);
    // The shared page under both verses, then 1:7's own.
    const captions = shown.filter(t => /^1:[67]/.test(t));
    expect(captions).toEqual(['1:6-7', '1:7']);
    expect(shown.indexOf('نص مشترك')).toBeLessThan(shown.indexOf('1:7'));
    expect(shown.indexOf('1:7')).toBeLessThan(shown.indexOf('نص خاص'));
  });

  it('says so when a verse has no word-by-word words', async () => {
    const words = mockWbw.get('1:4') ?? [];
    mockWbw.set('1:4', []);
    try {
      await open(hafs('1:4'));
      expect(texts()).toContain("Word data isn't available for this verse.");
      expect(mockRecorded.grid).toBeUndefined();
      expect(() => control('Next word')).toThrow();
    } finally {
      mockWbw.set('1:4', words);
    }
  });

  it('shows a spinner while loading, and a retry after a failure', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let fail: (e: Error) => void = () => undefined;
    (wbwDataService.getVerseWords as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    await open(hafs('1:4'));
    expect(root().findAll(n => n.type === ActivityIndicator)).toHaveLength(1);
    expect(() => control('Next word')).toThrow();
    await act(async () => fail(new Error('disk')));
    await settle();
    expect(texts()).toContain("Couldn't load the words.");
    await press('Try again');
    await settle();
    expect(cardWord()).toBe('1:4:1');
    (console.warn as jest.Mock).mockRestore();
  });
});

describe('several Hafs verses (1:6, 1:7)', () => {
  it('shows a chip per verse and steps across them', async () => {
    await open(hafs('1:6', '1:7'), {verseKey: '1:6', position: 3});
    // The tabs, then a chip per verse, the first verse first.
    expect(
      withRole('tab').map(t => t.props.accessibilityState.selected),
    ).toEqual([true, false, true, false]);
    expect(texts()).toEqual(expect.arrayContaining(['1:6', '1:7']));
    expect(texts()).toContain('Word 3 of 12');
    await press('Next word');
    expect(cardWord()).toBe('1:7:1');
    expect(last('grid').verseKey).toBe('1:7');
    expect(texts()).toContain('Word 4 of 12');
  });

  it('a chip goes to the first word of its verse', async () => {
    await open(hafs('1:6', '1:7'));
    await press('1:7');
    expect(cardWord()).toBe('1:7:1');
    expect(last('grid').verseKey).toBe('1:7');
  });

  it('prefetches the readings of the next verse', async () => {
    await open(hafs('1:6', '1:7'));
    expect(wordReadingsService.request).toHaveBeenCalledWith('1:7');
  });
});

describe('another rewayah (Warsh)', () => {
  it('Warsh 1:6 steps through Hafs 1:7 words 1-4, captioned', async () => {
    await open(warshVerses('1:6'));
    expect(last('grid')).toMatchObject({
      verseKey: '1:7',
      wordRange: {first: 1, last: 4},
      rewayah: 'warsh',
    });
    expect(texts()).toEqual(
      expect.arrayContaining(['Hafs 1:7', 'Word 1 of 4']),
    );
    expect(last('card')).toMatchObject({rewayah: 'warsh'});
    const canOpen = last('card').canOpen as (ref: WordRef) => boolean;
    expect(canOpen({verseKey: '1:7', position: 4})).toBe(true);
    // Word 6 of Hafs 1:7 is Warsh 1:7's: quoted, not opened.
    expect(canOpen({verseKey: '1:7', position: 6})).toBe(false);
    await press('Next word');
    await press('Next word');
    await press('Next word');
    expect(cardWord()).toBe('1:7:4');
    expect(control('Next word').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('Warsh 103:1 holds two Hafs verses: two chips, five steps', async () => {
    await open(warshVerses('103:1'));
    expect(texts()).toEqual(
      expect.arrayContaining(['Hafs 103:1', 'Hafs 103:2', 'Word 1 of 5']),
    );
  });

  it('opens a reference in the selection, in one-word mode', async () => {
    await open(warshVerses('103:1'));
    await press('Whole verse');
    const onRef = last('compact').onRef as (ref: WordRef) => void;
    act(() => onRef({verseKey: '103:2', position: 2}));
    expect(cardWord()).toBe('103:2:2');
    expect(last('grid').verseKey).toBe('103:2');
    expect(texts()).toContain('Whole verse');
  });
});

// @ai-start
describe("Warsh's unnumbered Fatiha basmala (Word Study only)", () => {
  it('steps through the words of Hafs 1:1 as another rewayah verse is shown', async () => {
    await open(warshBasmala(), {verseKey: '1:1', position: 2});
    expect(last('grid')).toMatchObject({
      verseKey: '1:1',
      wordRange: undefined,
      rewayah: 'warsh',
      selectedWordPosition: 2,
    });
    // Named as Hafs, as Warsh's verses are; one verse: no chips.
    expect(texts()).toEqual(
      expect.arrayContaining(['Hafs 1:1', 'Word 2 of 4']),
    );
    expect(withRole('tab')).toHaveLength(2);
    // The card is Warsh's: its Hafs chip and note, Warsh Current in Readings.
    expect(last('card')).toMatchObject({
      rewayah: 'warsh',
      word: {verseKey: '1:1', position: 2},
    });
    await press('Next word');
    await press('Next word');
    expect(cardWord()).toBe('1:1:4');
    // The verse-end marker is no word: the basmala ends here.
    expect(control('Next word').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it("the books tab shows Hafs 1:1's passages, named as Hafs", async () => {
    (irabDataService.getBooks as jest.Mock).mockImplementationOnce(async () => [
      {
        bookId: 1,
        nameAr: 'كتاب',
        authorAr: 'مؤلف',
        passages: [{id: 1, text: 'نص', part: '1', page: '2'}],
      },
    ]);
    await open(warshBasmala());
    await press("I'rab books");
    await settle();
    expect(irabDataService.getBooks).toHaveBeenCalledTimes(1);
    expect(irabDataService.getBooks).toHaveBeenCalledWith('1:1');
    expect(texts()).toEqual(expect.arrayContaining(['Hafs 1:1', 'كتاب', 'نص']));
  });
});
// @ai-end

describe('arrow keys on iPad', () => {
  it('← is the next word and → the previous, as in the reader', async () => {
    resetKeyCommandsForTests(true);
    await open(hafs('1:4'));
    act(() => pressKeyForTests('left'));
    expect(cardWord()).toBe('1:4:2');
    act(() => pressKeyForTests('right'));
    expect(cardWord()).toBe('1:4:1');
  });

  /** The reader's page turns, bound under the sheet as on iPad. */
  function readerUnderneath() {
    const next = jest.fn();
    const previous = jest.fn();
    addKeyLayer([
      {key: 'left', title: 'Next Page', menu: 'reader', run: next},
      {key: 'right', title: 'Previous Page', menu: 'reader', run: previous},
    ]);
    return {next, previous};
  }

  it('steps no word in whole-verse mode, and keeps the arrows from the reader under it', async () => {
    resetKeyCommandsForTests(true);
    const reader = readerUnderneath();
    await open(hafs('1:4'));
    await press('Whole verse');
    act(() => pressKeyForTests('left'));
    act(() => pressKeyForTests('right'));
    expect(texts()).toContain('One word');
    expect(last('grid').selectedWordPosition).toBeNull();
    expect(reader.next).not.toHaveBeenCalled();
    expect(reader.previous).not.toHaveBeenCalled();
  });

  it('keeps the arrows from the reader in the books tab and while the words load', async () => {
    resetKeyCommandsForTests(true);
    const reader = readerUnderneath();
    let load: (words: unknown) => void = () => undefined;
    (wbwDataService.getVerseWords as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          load = resolve;
        }),
    );
    await open(hafs('1:4'));
    expect(root().findAll(n => n.type === ActivityIndicator)).toHaveLength(1);
    act(() => pressKeyForTests('left'));
    await act(async () => load(mockWbw.get('1:4')));
    await settle();
    await press("I'rab books");
    await settle();
    act(() => pressKeyForTests('left'));
    act(() => pressKeyForTests('right'));
    expect(reader.next).not.toHaveBeenCalled();
    expect(reader.previous).not.toHaveBeenCalled();
    // Back on the words, ← steps again.
    await press('Words');
    act(() => pressKeyForTests('left'));
    expect(cardWord()).toBe('1:4:2');
    expect(reader.next).not.toHaveBeenCalled();
  });

  it('binds nothing where shortcuts are not supported', async () => {
    resetKeyCommandsForTests(false);
    await open(hafs('1:4'));
    act(() => pressKeyForTests('left'));
    expect(cardWord()).toBe('1:4:1');
  });
});
