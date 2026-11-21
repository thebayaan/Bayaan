// @ai-generated
/**
 * The i'rab building blocks IrabContent.tsx exports for Word Study
 * (IrabEntryList, MorphTable, IrabBooksTab, renderRefs): a word reference
 * is a tappable «word» only when canOpen allows it, and is otherwise plain
 * text; a word whose text is unknown reads "word N", and a word of another
 * verse also names that verse. The lines of 1:5:2 from the bundled i'rab,
 * plus one constructed line holding every kind of reference; placeholder
 * books.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {useTranslation} from 'react-i18next';

// IrabContent.tsx holds only the i'rab building blocks now (the I'rab screen
// became Word Study); these mocks keep native and data modules out.
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('react-native-actions-sheet', () => ({ScrollView: () => null}));
// The theme the blocks are drawn with; a test may swap in an app theme.
const mockTheme: {current: unknown} = {
  current: {
    isDarkMode: false,
    colors: {
      text: '#111111',
      textSecondary: '#666666',
      background: '#ffffff',
      primary: '#0a7d5a',
    },
  },
};
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({theme: mockTheme.current}),
}));
jest.mock('@/services/mushaf/MushafPreloadService', () => ({
  mushafPreloadService: {initialized: false},
}));
jest.mock('@/hooks/useMushafFontMgr', () => ({useMushafFontMgr: () => null}));
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: {},
}));
jest.mock('@/store/tajweedStore', () => ({useTajweedStore: () => null}));
jest.mock('@/services/wbw/WBWDataService', () => ({wbwDataService: {}}));
jest.mock('@/services/irab/IrabDataService', () => ({irabDataService: {}}));

import Color from 'color';
import {useTheme} from '@/hooks/useTheme';
import type {IrabBookPassages, WordIrab} from '@/services/irab/irabFormat';
import {primaryColors, type PrimaryColor} from '@/styles/colorSchemes';
import {createTheme, type Theme} from '@/utils/themeUtils';
import {
  createIrabStyles,
  IrabBooksTab,
  IrabEntryList,
  MorphTable,
  type IrabRefContext,
} from '../IrabContent';
import type {WordRef} from '../wordStudy';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

/** The app's words of 1:5, as the screen quotes them. */
const WORDS: Record<number, string> = {
  1: 'إِيَّاكَ',
  2: 'نَعْبُدُ',
  3: 'وَإِيَّاكَ',
  4: 'نَسْتَعِينُ',
};
const wordTextOf = (verseKey: string, position: number) =>
  verseKey === '1:5' ? WORDS[position] : undefined;

// نَعْبُدُ (1:5:2) as the bundled i'rab has it (agreed set for the mark),
// plus a constructed line referring to word 1, to word 9 (whose text is
// unknown) and to a word of another verse.
const NABUDU: WordIrab = {
  position: 2,
  entries: [
    {kind: 'stem', label: '', text: 'فعل مضارع مرفوع وعلامة رفعه الضمة'},
    {kind: 'implied', label: 'مقدَّر', text: 'الفاعل ضمير مستتر تقديره «نحن»'},
    {
      kind: 'alt',
      label: 'وجه آخر',
      text: 'ومفعوله {{1}}، ويتعلق بـ{{9}} و{{1:4:1}}',
    },
  ],
  agreed: true,
  morph: [
    {label: 'الجذر', value: 'ع ب د'},
    {label: 'التعدي', value: 'متعدٍّ، ومفعوله {{1}}'},
  ],
};

interface Rendered {
  renderer: TestRenderer.ReactTestRenderer;
  onRef: jest.Mock;
  canOpen: jest.Mock;
}

/** Renders one block with the screen's own styles and translations. */
function render(
  block: (context: IrabRefContext) => React.ReactElement,
  canOpenRef: (ref: WordRef) => boolean,
  over: Partial<IrabRefContext> = {}, // @ai
): Rendered {
  const onRef = jest.fn();
  const canOpen = jest.fn(canOpenRef);
  function Harness() {
    const {t} = useTranslation('sheets');
    const {theme} = useTheme();
    const styles = createIrabStyles(theme);
    return block({
      verseKey: '1:5',
      wordTextOf,
      canOpen,
      onRef,
      styles,
      t,
      ...over, // @ai
    });
  }
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });
  if (!renderer) throw new Error('not rendered');
  return {renderer, onRef, canOpen};
}

/** The Text elements that open a reference, by their text. */
function tappable(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll(
      n =>
        (n.type as unknown) === Text && typeof n.props.onPress === 'function',
    )
    .map(n => String(n.props.children));
}

/** Every string rendered, in order. */
function strings(renderer: TestRenderer.ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as {children: unknown}).children);
    }
  };
  walk(renderer.toJSON());
  return out;
}

describe('IrabEntryList', () => {
  it('a reference that can be opened is a tappable «word» calling onRef', () => {
    const {renderer, onRef, canOpen} = render(
      context => <IrabEntryList word={NABUDU} {...context} />,
      () => true,
    );
    // A reference to another verse names that verse (isolated). @ai
    expect(tappable(renderer)).toEqual([
      '«إِيَّاكَ»',
      'word 9',
      '\u2068word 1 (1:4)\u2069',
    ]);
    const word1 = renderer.root.find(
      n => (n.type as unknown) === Text && n.props.children === '«إِيَّاكَ»',
    );
    act(() => word1.props.onPress());
    expect(onRef).toHaveBeenCalledWith({verseKey: '1:5', position: 1});
    expect(canOpen).toHaveBeenCalledWith({verseKey: '1:4', position: 1});
    act(() => renderer.unmount());
  });

  // @ai-start
  it("quotes another verse's word when its text is known, naming the verse as the caller does", () => {
    const {renderer, onRef} = render(
      context => <IrabEntryList word={NABUDU} {...context} />,
      ref => ref.verseKey === '1:4',
      {
        wordTextOf: (verseKey, position) =>
          verseKey === '1:4' && position === 1
            ? 'مَٰلِكِ'
            : wordTextOf(verseKey, position),
        verseLabel: verseKey => `Hafs ${verseKey}`,
      },
    );
    const other = '\u2068«مَٰلِكِ» (Hafs 1:4)\u2069';
    expect(tappable(renderer)).toEqual([other]);
    act(() =>
      renderer.root
        .find(n => (n.type as unknown) === Text && n.props.children === other)
        .props.onPress(),
    );
    expect(onRef).toHaveBeenCalledWith({verseKey: '1:4', position: 1});
    // A word of the text's own verse names no verse.
    expect(strings(renderer).join('')).toContain('ومفعوله «إِيَّاكَ»');
    act(() => renderer.unmount());
  });
  // @ai-end

  it('a reference that cannot be opened is plain text with no onPress', () => {
    const {renderer, onRef} = render(
      context => <IrabEntryList word={NABUDU} {...context} />,
      ref => ref.position === 9,
    );
    expect(tappable(renderer)).toEqual(['word 9']);
    const text = strings(renderer).join('');
    expect(text).toContain('ومفعوله «إِيَّاكَ»');
    expect(text).toContain('\u2068word 1 (1:4)\u2069'); // @ai
    expect(onRef).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('shows the entry labels and the agreed mark', () => {
    const {renderer} = render(
      context => <IrabEntryList word={NABUDU} {...context} />,
      () => false,
    );
    const text = strings(renderer);
    expect(text).toContain('Implied');
    expect(text).toContain('وجه آخر');
    expect(text).toContain('Confirmed by two independent analyses');
    act(() => renderer.unmount());

    const {renderer: notAgreed} = render(
      context => (
        <IrabEntryList word={{...NABUDU, agreed: false}} {...context} />
      ),
      () => false,
    );
    expect(strings(notAgreed)).not.toContain(
      'Confirmed by two independent analyses',
    );
    act(() => notAgreed.unmount());
  });
});

describe('MorphTable', () => {
  it('shows each label and value, with the references filled in', () => {
    const {renderer, onRef} = render(
      context => <MorphTable facts={NABUDU.morph} {...context} />,
      () => true,
    );
    const text = strings(renderer);
    expect(text[0]).toBe('Morphology (ṣarf)');
    expect(text).toEqual(
      expect.arrayContaining(['الجذر', 'ع ب د', 'التعدي', '«إِيَّاكَ»']),
    );
    expect(tappable(renderer)).toEqual(['«إِيَّاكَ»']);
    act(() =>
      renderer.root
        .find(
          n =>
            (n.type as unknown) === Text && n.props.children === '«إِيَّاكَ»',
        )
        .props.onPress(),
    );
    expect(onRef).toHaveBeenCalledWith({verseKey: '1:5', position: 1});
    act(() => renderer.unmount());
  });
});

describe('IrabBooksTab', () => {
  const BOOK: IrabBookPassages = {
    bookId: 1,
    nameAr: 'كتاب',
    authorAr: 'مؤلف',
    passages: [{id: 1, text: 'نص', part: '1', page: '20'}],
  };

  it('shows each part with its caption and books', () => {
    const {renderer} = render(
      context => (
        <IrabBooksTab
          parts={[
            {verseKey: '103:1', caption: 'Hafs 103:1', books: [BOOK]},
            {verseKey: '103:2', caption: 'Hafs 103:2', books: []},
          ]}
          styles={context.styles}
          t={context.t}
        />
      ),
      () => true,
    );
    const text = strings(renderer);
    expect(text).toContain('Hafs 103:1');
    // No books: no caption.
    expect(text).not.toContain('Hafs 103:2');
    expect(text).toEqual(expect.arrayContaining(['كتاب', 'مؤلف', 'نص']));
    act(() => renderer.unmount());
  });

  it('cuts a long passage, with a Read more button that says whether it is open', () => {
    const long = `${'نص '.repeat(300)}نهاية`;
    const {renderer} = render(
      context => (
        <IrabBooksTab
          parts={[
            {
              verseKey: '2:255',
              caption: null,
              books: [
                {
                  ...BOOK,
                  passages: [{id: 2, text: long, part: '1', page: '20'}],
                },
              ],
            },
          ]}
          styles={context.styles}
          t={context.t}
        />
      ),
      () => true,
    );
    const button = () =>
      renderer.root.findByProps({accessibilityRole: 'button'});
    expect(strings(renderer).join('')).not.toContain('نهاية');
    expect(button().props.accessibilityState).toEqual({expanded: false});
    // A 44pt target, and a hover state.
    const {hitSlop, style} = button().props;
    const minHeight = StyleSheet.flatten(
      typeof style === 'function' ? style({pressed: false}) : style,
    ).minHeight as number;
    expect(minHeight + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(44);
    expect(typeof button().props.onPointerEnter).toBe('function');
    // Chrome: the text colour, not the accent.
    const label = renderer.root.find(
      n => (n.type as unknown) === Text && n.props.children === 'Read more',
    );
    expect(StyleSheet.flatten(label.props.style).color).toBe('#111111');
    act(() => button().props.onPress());
    expect(strings(renderer).join('')).toContain('نهاية');
    expect(strings(renderer)).toContain('Show less');
    expect(button().props.accessibilityState).toEqual({expanded: true});
    act(() => renderer.unmount());
  });

  it('says when no book discusses the verses', () => {
    const {renderer} = render(
      context => (
        <IrabBooksTab
          parts={[{verseKey: '1:5', caption: null, books: []}]}
          styles={context.styles}
          t={context.t}
        />
      ),
      () => true,
    );
    expect(strings(renderer)).toContain(
      'These books have no passage for this verse.',
    );
    act(() => renderer.unmount());
  });
});

describe('text in the accent colour', () => {
  const ACCENTS = Object.keys(primaryColors) as PrimaryColor[];
  const ratio = (a: unknown, b: string) => Color(String(a)).contrast(Color(b));
  /** The sheet, the morphology block's 4% fill, a hovered row's 6% fill,
   *  an alternative entry's 7% accent tint, and that tint over the 6% fill
   *  (the entry inside a pressed or hovered whole-verse word card). */
  const surfacesOf = (theme: Theme) => {
    const background = Color(theme.colors.background);
    const hovered = background.mix(Color(theme.colors.text), 0.06);
    return [
      background.hex(),
      background.mix(Color(theme.colors.text), 0.04).hex(),
      hovered.hex(),
      background.mix(Color(theme.colors.primary), 0.07).hex(),
      hovered.mix(Color(theme.colors.primary), 0.07).hex(),
    ];
  };

  it.each(['light', 'dark'] as const)(
    'reads at 4.5:1 or more on every surface, with every accent (%s)',
    scheme => {
      const failures: string[] = [];
      for (const accent of ACCENTS) {
        const theme = createTheme(scheme, accent);
        const styles = createIrabStyles(theme);
        const colors = {
          label: styles.entryLabel.color,
          altLabel: styles.entryLabelAlt.color,
          reference: styles.ref.color,
          morphologyLabel: styles.morphLabel.color,
        };
        for (const [name, color] of Object.entries(colors)) {
          for (const surface of surfacesOf(theme)) {
            const r = ratio(color, surface);
            if (r < 4.5) failures.push(`${accent} ${name} on ${surface}: ${r}`);
          }
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it('draws the labels, the references and the agreed mark readable with the default Blue', () => {
    const theme = createTheme('light', 'Blue');
    const before = mockTheme.current;
    mockTheme.current = theme;
    try {
      const {renderer} = render(
        context => <IrabEntryList word={NABUDU} {...context} />,
        () => true,
      );
      const background = theme.colors.background;
      const label = renderer.root.find(
        n =>
          (n.type as unknown) === Text && n.props.children?.[0] === 'وجه آخر',
      );
      expect(
        ratio(StyleSheet.flatten(label.props.style).color, background),
      ).toBeGreaterThanOrEqual(4.5);
      const reference = renderer.root.find(
        n => (n.type as unknown) === Text && n.props.children === '«إِيَّاكَ»',
      );
      expect(
        ratio(StyleSheet.flatten(reference.props.style).color, background),
      ).toBeGreaterThanOrEqual(4.5);
      // An icon: 3:1 at least.
      const mark = renderer.root.find(n => n.props.name === 'check-circle');
      expect(ratio(mark.props.color, background)).toBeGreaterThanOrEqual(3);
      act(() => renderer.unmount());
    } finally {
      mockTheme.current = before;
    }
  });
});
