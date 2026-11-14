// @ai-generated
/**
 * The i'rab building blocks IrabContent.tsx exports for Word Study
 * (IrabEntryList, MorphTable, IrabBooksTab, renderRefs): a word reference
 * is a tappable «word» only when canOpen allows it, and is otherwise plain
 * text; a word whose text is unknown reads "word N". The lines of 1:5:2 from
 * the bundled i'rab, plus one constructed line holding every kind of
 * reference; placeholder books.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {useTranslation} from 'react-i18next';

// IrabContent.tsx also holds the I'rab screen: keep its heavy imports out.
jest.mock(
  '@/components/player/v2/PlayerContent/QuranView/WBWVerseView',
  () => ({WBWVerseView: () => null}),
);
jest.mock('@expo/vector-icons', () => ({Feather: () => null}));
jest.mock('react-native-actions-sheet', () => ({ScrollView: () => null}));
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

import {useTheme} from '@/hooks/useTheme';
import type {IrabBookPassages, WordIrab} from '@/services/irab/irabFormat';
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
): Rendered {
  const onRef = jest.fn();
  const canOpen = jest.fn(canOpenRef);
  function Harness() {
    const {t} = useTranslation('sheets');
    const {theme} = useTheme();
    const styles = createIrabStyles(theme);
    return block({verseKey: '1:5', wordTextOf, canOpen, onRef, styles, t});
  }
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    renderer = TestRenderer.create(<Harness />);
  });
  if (!renderer) throw new Error('not rendered');
  return {renderer, onRef, canOpen};
}

/** Host Text nodes that open a reference, by their text. */
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
    expect(tappable(renderer)).toEqual(['«إِيَّاكَ»', 'word 9', 'word 1']);
    const word1 = renderer.root.find(
      n => (n.type as unknown) === Text && n.props.children === '«إِيَّاكَ»',
    );
    act(() => word1.props.onPress());
    expect(onRef).toHaveBeenCalledWith({verseKey: '1:5', position: 1});
    // A reference to another verse names that verse.
    expect(canOpen).toHaveBeenCalledWith({verseKey: '1:4', position: 1});
    act(() => renderer.unmount());
  });

  it('a reference that cannot be opened is plain text with no onPress', () => {
    const {renderer, onRef} = render(
      context => <IrabEntryList word={NABUDU} {...context} />,
      ref => ref.position === 9,
    );
    expect(tappable(renderer)).toEqual(['word 9']);
    const text = strings(renderer).join('');
    expect(text).toContain('ومفعوله «إِيَّاكَ»');
    expect(text).toContain('word 1');
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
    passages: [{text: 'نص', part: '1', page: '20'}],
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
