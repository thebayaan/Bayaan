// @ai-generated
/**
 * The Word Study card (WordCard.tsx): the header draws the mushaf's own
 * word, never the word-by-word text (2:4:9 is damaged there), with the
 * transliteration, meaning, Play and reference; the Hafs chip and note
 * only for another rewayah; then Readings, I'rab, Morphology, Arabic
 * meaning and Rasm, each drawn only with something to show. The header
 * word, word audio and the Readings section are recorders; the i'rab lines
 * are those of the bundled data for 2:255:1 (shortened), the gharib and
 * rasm rows the word-data fixtures.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import type {WordAudioState} from '@/hooks/useWordAudio';

const mockRecorded: Record<string, Record<string, unknown>[]> = {};
function mockRecord(name: string, props: Record<string, unknown>) {
  (mockRecorded[name] ??= []).push(props);
  return null;
}
const mockAudio: {state: WordAudioState; toggle: jest.Mock; urls: unknown[]} = {
  state: 'idle',
  toggle: jest.fn(),
  urls: [],
};

jest.mock('../WordHeaderText', () => ({
  WordHeaderText: (props: Record<string, unknown>) =>
    mockRecord('header', props),
}));
jest.mock('../WordReadingsSection', () => ({
  WordReadingsSection: (props: Record<string, unknown>) =>
    mockRecord('readings', props),
}));
jest.mock('@/hooks/useWordAudio', () => ({
  useWordAudio: (url: string | null) => {
    mockAudio.urls.push(url);
    return {state: mockAudio.state, toggle: mockAudio.toggle};
  },
}));
jest.mock('@/components/Icons', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));
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

import type {WordIrab} from '@/services/irab/irabFormat';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import type {WBWWord} from '@/services/wbw/WBWDataService';
import type {VerseWordStudy} from '@/services/wordStudy/wordStudyFormat';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {
  CompactWordCard,
  DEFAULT_CARD_SECTIONS,
  WordCard,
  type CardSection,
  type WordCardProps,
} from '../WordCard';
import type {StudyWord, WordRef} from '../wordStudy';
import {entry, hadhf, unit} from '../word-study/__fixtures__/sections';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

// 2:4:9 in the bundled data: the mushaf (DigitalKhatt) slot is whole, the
// word-by-word text holds U+FFFD.
const QABLIKA = 'قَبْلِكَ';
const QABLIKA_WBW = 'قَبْ��ِكَ';
const WORD_2_4_9: StudyWord = {
  verseKey: '2:4',
  position: 9,
  index: 8,
  part: 0,
  slots: ['2:4:9'],
  text: QABLIKA,
};
const SLOTS_2_4_9 = [{text: QABLIKA, verseKey: '2:4', wordPositionInVerse: 9}];
const WBW_2_4_9: WBWWord = {
  position: 9,
  textUthmani: QABLIKA_WBW,
  translation: 'before you',
  transliteration: 'qablika',
  audioUrl: '',
};

// ٱللَّهُ (2:255:1): entries shortened from the bundled i'rab, with a
// reference to word 2; the morphology's own labels.
const IRAB: WordIrab = {
  position: 1,
  entries: [
    {kind: 'stem', label: '', text: 'لفظ الجلالة مبتدأ مرفوع'},
    {kind: 'stem', label: '', text: 'وخبره {{2}}'},
  ],
  agreed: true,
  morph: [
    {label: 'الجذر', value: 'ء ل ه'},
    {label: 'الوزن', value: 'فِعَال'},
    {label: 'الأصل المعجمي', value: 'ٱللَّه'},
    {label: 'العدد', value: 'مفرد'},
  ],
};

const STUDY: VerseWordStudy = {
  verseKey: '1:4',
  gharib: [entry(1, [1, 1], 'المالك يوم الجزاء')],
  rasm: [unit([hadhf])],
};

let renderer: TestRenderer.ReactTestRenderer | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

beforeEach(() => {
  for (const key of Object.keys(mockRecorded)) delete mockRecorded[key];
  mockAudio.state = 'idle';
  mockAudio.toggle = jest.fn();
  mockAudio.urls = [];
  useMushafSettingsStore.setState({
    mushafRenderer: 'dk_v2',
    arabicFontSize: 26,
  });
});

const props = (over: Partial<WordCardProps> = {}): WordCardProps => ({
  word: WORD_2_4_9,
  slots: SLOTS_2_4_9,
  wbw: WBW_2_4_9,
  irab: undefined,
  rewayah: 'hafs',
  study: null,
  wordTextOf: (verseKey, position) =>
    verseKey === '2:255' && position === 2 ? 'لَآ' : undefined,
  canOpen: () => true,
  onRef: jest.fn(),
  expanded: DEFAULT_CARD_SECTIONS,
  onToggle: jest.fn(),
  fontMgr: null,
  ...over,
});

function render(
  element: Parameters<typeof TestRenderer.create>[0],
): TestRenderer.ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** The root of what is rendered now. */
function current(): TestRenderer.ReactTestInstance {
  if (!renderer) throw new Error('nothing rendered');
  return renderer.root;
}

/** Every string drawn in a Text, in order. */
function texts(root: TestRenderer.ReactTestInstance): string[] {
  return root
    .findAll(n => (n.type as unknown) === Text)
    .flatMap(n =>
      [n.props.children]
        .flat(Infinity)
        .filter((c): c is string => typeof c === 'string'),
    );
}

const allText = (root: TestRenderer.ReactTestInstance) => texts(root).join('|');

function pressable(
  root: TestRenderer.ReactTestInstance,
  label: string,
): TestRenderer.ReactTestInstance {
  const found = root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAll(c => c.props.children === label).length > 0),
  );
  if (found.length === 0) throw new Error(`no button ${label}`);
  return found[found.length - 1];
}

const last = (name: string) => {
  const calls = mockRecorded[name] ?? [];
  return calls[calls.length - 1];
};

describe('header', () => {
  it("draws the mushaf's own word, never the damaged word-by-word text", () => {
    const root = render(<WordCard {...props()} />);
    expect(last('header')).toMatchObject({
      verseKey: '2:4',
      slots: SLOTS_2_4_9,
      fontFamily: 'DigitalKhattV2',
      rnFontFamily: 'DigitalKhattV2',
      // round(26 x 1.4): reading points, not scaled.
      fontSize: 36,
    });
    expect(allText(root)).not.toContain('�');
    expect(texts(root)).toEqual(
      expect.arrayContaining(['qablika', '“before you”', '2:4 · word 9']),
    );
  });

  it('keeps the IndoPak face for Skia and draws the fallback in V2', () => {
    useMushafSettingsStore.setState({mushafRenderer: 'dk_indopak'});
    render(<WordCard {...props()} />);
    expect(last('header')).toMatchObject({
      fontFamily: 'DigitalKhattIndoPak',
      rnFontFamily: 'DigitalKhattV2',
    });
  });

  it('shows no Hafs chip or note for a Hafs selection', () => {
    const root = render(<WordCard {...props()} />);
    expect(texts(root)).not.toContain('Hafs');
    expect(allText(root)).not.toContain('are for Hafs');
  });

  it('marks the data as Hafs for another rewayah, naming it in Readings', () => {
    const root = render(<WordCard {...props({rewayah: 'warsh'})} />);
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Hafs',
        'Hafs 2:4 · word 9',
        "Meanings, audio, i'rab, morphology and rasm are for Hafs. Readings shows how Warsh reads it.",
      ]),
    );
  });

  it('uses the plain Hafs note for a rewayah Readings does not cover', () => {
    const root = render(
      <WordCard {...props({rewayah: 'hisham' as RewayahId})} />,
    );
    expect(texts(root)).toContain(
      "Meanings, audio, i'rab, morphology and rasm are for Hafs.",
    );
  });

  it('plays the word from its Hafs verse and word-by-word position', () => {
    const root = render(<WordCard {...props()} />);
    expect(mockAudio.urls).toContain(
      'https://audio.qurancdn.com/wbw/002_004_009.mp3',
    );
    const play = pressable(root, 'Play the word');
    expect(play.props.accessibilityRole).toBe('button');
    expect(play.props.accessibilityValue).toEqual({text: 'Play'});
    act(() => play.props.onPress());
    expect(mockAudio.toggle).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['loading', 'Loading…', true],
    ['playing', 'Pause', false],
    ['error', "Couldn't play", false],
  ] as const)('shows the %s state', (state, label, busy) => {
    mockAudio.state = state;
    const root = render(<WordCard {...props()} />);
    const play = pressable(root, 'Play the word');
    expect(play.props.accessibilityValue).toEqual({text: label});
    expect(play.props.accessibilityState).toEqual({busy});
    expect(texts(root)).toContain(label);
  });
});

describe('sections', () => {
  const wordOf = (position: number): StudyWord => ({
    verseKey: '2:255',
    position,
    index: position - 1,
    part: 0,
    slots: [`2:255:${position}`],
    text: 'ٱللَّهُ',
  });

  it('mounts Readings for the word, in its Hafs numbering, with the current rewayah', () => {
    render(<WordCard {...props({rewayah: 'warsh'})} />);
    expect(last('readings')).toEqual({
      verseKey: '2:4',
      wbwPosition: 9,
      currentRewayah: 'warsh',
    });
  });

  it("draws the i'rab entries, the agreed mark and the references", () => {
    const onRef = jest.fn();
    const root = render(
      <WordCard {...props({word: wordOf(1), irab: IRAB, onRef})} />,
    );
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        "I'rab",
        'لفظ الجلالة مبتدأ مرفوع',
        'Confirmed by two independent analyses',
        '«لَآ»',
      ]),
    );
    act(() =>
      root
        .findAll(n => (n.type as unknown) === Text && n.props.onPress)
        .find(n => n.props.children === '«لَآ»')
        ?.props.onPress(),
    );
    expect(onRef).toHaveBeenCalledWith({verseKey: '2:255', position: 2});
  });

  it("says the i'rab failed, and hides morphology, when it could not load", () => {
    const root = render(<WordCard {...props({irab: null})} />);
    expect(texts(root)).toEqual(
      expect.arrayContaining(["I'rab", "Couldn't load the i'rab."]),
    );
    expect(texts(root)).not.toContain('Morphology (ṣarf)');
  });

  it("draws no I'rab or Morphology section for a word without them", () => {
    const root = render(<WordCard {...props({irab: undefined})} />);
    expect(texts(root)).not.toContain("I'rab");
    expect(texts(root)).not.toContain('Morphology (ṣarf)');
  });

  it('shows the root and the lemma, the other facts behind Show more', () => {
    const onToggle = jest.fn();
    const root = render(
      <WordCard {...props({word: wordOf(1), irab: IRAB, onToggle})} />,
    );
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'Morphology (ṣarf)',
        'الجذر',
        'ء ل ه',
        'الأصل المعجمي',
        'ٱللَّه',
        'Show more',
      ]),
    );
    expect(texts(root)).not.toContain('فِعَال');
    act(() => pressable(root, 'Show more').props.onPress());
    expect(onToggle).toHaveBeenCalledWith('morphologyMore');

    act(() =>
      renderer?.update(
        <WordCard
          {...props({
            word: wordOf(1),
            irab: IRAB,
            expanded: {...DEFAULT_CARD_SECTIONS, morphologyMore: true},
          })}
        />,
      ),
    );
    const shown = texts(current());
    // The other facts in data order, after root and lemma.
    expect(shown.indexOf('الوزن')).toBeGreaterThan(
      shown.indexOf('الأصل المعجمي'),
    );
    expect(shown.indexOf('العدد')).toBeGreaterThan(shown.indexOf('الوزن'));
    expect(pressable(current(), 'Show less').props.accessibilityState).toEqual({
      expanded: true,
    });
  });

  it('a particle without root or lemma shows its facts at once', () => {
    const root = render(
      <WordCard
        {...props({
          word: wordOf(1),
          irab: {...IRAB, morph: [{label: 'النوع', value: 'حرف'}]},
        })}
      />,
    );
    expect(texts(root)).toEqual(expect.arrayContaining(['النوع', 'حرف']));
    expect(texts(root)).not.toContain('Show more');
  });

  it('the root is a chip that searches it, only when root search is wired', () => {
    const onRootPress = jest.fn();
    const root = render(
      <WordCard {...props({word: wordOf(1), irab: IRAB, onRootPress})} />,
    );
    const chip = pressable(root, 'Search the root ء ل ه');
    expect(chip.props.accessibilityRole).toBe('button');
    act(() => chip.props.onPress());
    expect(onRootPress).toHaveBeenCalledWith('ء ل ه', 'ٱللَّه');

    const plain = render(
      <WordCard {...props({word: wordOf(1), irab: IRAB})} />,
    );
    expect(texts(plain)).toContain('ء ل ه');
    expect(
      plain.findAll(n => /root/.test(String(n.props.accessibilityLabel ?? ''))),
    ).toEqual([]);
  });

  it('every section header states whether it is open, and toggles', () => {
    const onToggle = jest.fn<void, [CardSection]>();
    const root = render(
      <WordCard {...props({word: wordOf(1), irab: IRAB, onToggle})} />,
    );
    const irab = pressable(root, "I'rab");
    const morphology = pressable(root, 'Morphology (ṣarf)');
    expect(irab.props.accessibilityState).toEqual({expanded: true});
    expect(morphology.props.accessibilityState).toEqual({expanded: true});
    act(() => irab.props.onPress());
    expect(onToggle).toHaveBeenCalledWith('irab');

    act(() =>
      renderer?.update(
        <WordCard
          {...props({
            word: wordOf(1),
            irab: IRAB,
            expanded: {...DEFAULT_CARD_SECTIONS, irab: false},
          })}
        />,
      ),
    );
    expect(pressable(current(), "I'rab").props.accessibilityState).toEqual({
      expanded: false,
    });
    expect(texts(current())).not.toContain('لفظ الجلالة مبتدأ مرفوع');
  });

  it('draws no Arabic meaning or Rasm without data', () => {
    const root = render(<WordCard {...props({study: null})} />);
    expect(texts(root)).not.toContain('Arabic meaning');
    expect(texts(root)).not.toContain('Rasm');
  });

  it("draws the word's Arabic meaning and rasm, last and in that order", () => {
    const word: StudyWord = {...wordOf(1), verseKey: '1:4', slots: ['1:4:1']};
    const root = render(
      <WordCard
        {...props({
          word,
          irab: IRAB,
          study: STUDY,
          wordTextOf: (verseKey, position) =>
            verseKey === '1:4' && position === 1 ? 'مَٰلِكِ' : undefined,
        })}
      />,
    );
    const shown = texts(root);
    expect(shown).toEqual(
      expect.arrayContaining([
        'Arabic meaning',
        'المالك يوم الجزاء',
        'Rasm',
        'مَٰلِكِ',
      ]),
    );
    const order = ["I'rab", 'Morphology (ṣarf)', 'Arabic meaning', 'Rasm'].map(
      title => shown.indexOf(title),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows no Arabic meaning for a word the entries do not cover', () => {
    const word: StudyWord = {...wordOf(2), verseKey: '1:4', slots: ['1:4:2']};
    const root = render(<WordCard {...props({word, study: STUDY})} />);
    expect(texts(root)).not.toContain('Arabic meaning');
    expect(texts(root)).not.toContain('Rasm');
  });
});

describe('CompactWordCard', () => {
  it("lists a word with its meaning, number and i'rab; a tap studies it", () => {
    const onStudy = jest.fn();
    const word: StudyWord = {
      verseKey: '2:255',
      position: 1,
      index: 0,
      part: 0,
      slots: ['2:255:1'],
      text: 'ٱللَّهُ',
    };
    const root = render(
      <CompactWordCard
        word={word}
        wbw={{...WBW_2_4_9, position: 1, translation: 'Allah'}}
        irab={IRAB}
        wordTextOf={() => undefined}
        canOpen={(_ref: WordRef) => true}
        onRef={jest.fn()}
        onStudy={onStudy}
      />,
    );
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        'ٱللَّهُ',
        'Allah',
        'word 1',
        'لفظ الجلالة مبتدأ مرفوع',
      ]),
    );
    // Morphology stays in one-word mode.
    expect(texts(root)).not.toContain('ء ل ه');
    // The card is read by its own text; 'Study ٱللَّهُ' is its hint.
    const card = root.find(
      n =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityHint === 'Study ٱللَّهُ' &&
        typeof n.props.onPress === 'function',
    );
    expect(card.props.accessibilityLabel).toBeUndefined();
    act(() => card.props.onPress());
    expect(onStudy).toHaveBeenCalledWith(word);
    const quran = root
      .findAll(n => (n.type as unknown) === Text)
      .find(n => n.props.children === 'ٱللَّهُ');
    expect(quran?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: 'DigitalKhattV2',
          fontSize: 22,
          lineHeight: 44,
        }),
      ]),
    );
  });
});
