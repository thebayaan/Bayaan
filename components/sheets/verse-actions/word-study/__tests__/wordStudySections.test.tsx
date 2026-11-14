// @ai-generated
import React, {act} from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer from 'react-test-renderer';

jest.mock('expo-localization', () => ({
  getLocales: () => [{languageCode: 'en'}],
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        text: '#111111',
        textSecondary: '#666666',
        primary: '#0a7d5a',
        background: '#ffffff',
      },
    },
  }),
}));

import {GharibSection} from '../GharibSection';
import {RasmSection} from '../RasmSection';
import {
  allText,
  entry,
  hadhf,
  unit,
  wordTextOf,
} from '../__fixtures__/sections';

declare const global: {IS_REACT_ACT_ENVIRONMENT?: boolean};
global.IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
function render(
  element: Parameters<typeof TestRenderer.create>[0],
): TestRenderer.ReactTestRenderer {
  const made: {tree?: TestRenderer.ReactTestRenderer} = {};
  act(() => {
    made.tree = TestRenderer.create(element);
  });
  if (!made.tree) throw new Error('nothing rendered');
  renderer = made.tree;
  return made.tree;
}
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

const FSI = '\u2068';
const PDI = '\u2069';

describe('GharibSection', () => {
  it('renders nothing without an entry on the word', () => {
    expect(
      render(
        <GharibSection entries={[]} position={1} wordTextOf={wordTextOf} />,
      ).toJSON(),
    ).toBeNull();
    // A verse-level entry, and one on another word.
    const others = [entry(1, null, 'شرح'), entry(2, [3, 3], 'شرح')];
    expect(
      render(
        <GharibSection entries={others} position={1} wordTextOf={wordTextOf} />,
      ).toJSON(),
    ).toBeNull();
  });

  it('shows the title, the gloss, the book and the source', () => {
    const text = allText(
      render(
        <GharibSection
          entries={[entry(1, [1, 1], 'المالك والمتصرف.')]}
          position={1}
          wordTextOf={wordTextOf}
        />,
      ).toJSON(),
    );
    expect(text).toContain('Arabic meaning');
    expect(text).toContain('المالك والمتصرف.');
    expect(text).toContain('كتاب الغريب — مؤلف');
    expect(text).toContain(`Text from ${FSI}Publisher${PDI}.`);
    // One word: no quote.
    expect(text).not.toContain('«');
  });

  it('quotes the app’s words of a span longer than one word', () => {
    const text = allText(
      render(
        <GharibSection
          entries={[entry(2, [2, 3], 'يوم الجزاء.')]}
          position={3}
          wordTextOf={wordTextOf}
        />,
      ).toJSON(),
    );
    expect(text).toContain('«يَوْمِ ٱلدِّينِ» يوم الجزاء.');
  });

  it('leaves the quote out when a word of the span is damaged', () => {
    const text = allText(
      render(
        <GharibSection
          entries={[entry(2, [2, 3], 'يوم الجزاء.')]}
          position={2}
          wordTextOf={p => (p === 3 ? undefined : wordTextOf(p))}
        />,
      ).toJSON(),
    );
    expect(text).not.toContain('«');
  });

  it('cuts a long gloss, with Show more and Show less', () => {
    const long = `${'كلمة '.repeat(100)}نهاية`;
    const tree = render(
      <GharibSection
        entries={[entry(1, [1, 1], long)]}
        position={1}
        wordTextOf={wordTextOf}
      />,
    );
    expect(allText(tree.toJSON())).not.toContain('نهاية');
    expect(allText(tree.toJSON())).toContain('Show more');
    const button = tree.root.findByProps({accessibilityRole: 'button'});
    act(() => button.props.onPress());
    expect(allText(tree.toJSON())).toContain('نهاية');
    expect(allText(tree.toJSON())).toContain('Show less');
  });
});

describe('RasmSection', () => {
  it('renders nothing without a unit or without a shown note', () => {
    expect(render(<RasmSection rasm={null} uthmani="x" />).toJSON()).toBeNull();
    const hidden = unit([{...hadhf, basis: 'unconfirmed'}]);
    expect(
      render(<RasmSection rasm={hidden} uthmani="x" />).toJSON(),
    ).toBeNull();
  });

  it('shows both spellings, one line per shown note and the source', () => {
    const tree = render(
      <RasmSection
        rasm={unit([
          hadhf,
          {
            kind: 'badal',
            standard: 'ى',
            mushaf: 'ا',
            mark: null,
            basis: 'unconfirmed',
          },
          {kind: 'wasl', standard: '', mushaf: '', mark: null, basis: 'rule'},
        ])}
        uthmani="مَـٰلِكِ"
      />,
    );
    const text = allText(tree.toJSON());
    expect(text).toContain('Rasm');
    expect(text).toContain('Mushafمَـٰلِكِ');
    expect(text).toContain('Standardمَالِكِ');
    expect(text).toContain(
      `Omitted (ḥadhf): ${FSI}«ا»${PDI} is not written in the mushaf.`,
    );
    expect(text).toContain(
      'Joined (waṣl): Written as one word in the mushaf; the standard spelling separates it.',
    );
    // The hidden note is not shown.
    expect(text).not.toContain('Substituted');
    expect(text).toContain(`Standard spelling from ${FSI}Text Project${PDI}.`);
  });

  it('marks the differing letters of the standard spelling', () => {
    const tree = render(
      <RasmSection rasm={unit([hadhf])} uthmani="مَـٰلِكِ" />,
    );
    // Host text nodes drawn in the mark colour.
    const marked = tree.root.findAll(
      node =>
        String(node.type) === 'Text' &&
        StyleSheet.flatten(node.props.style)?.color === '#0a7d5a',
    );
    expect(marked.map(node => allText(node.props.children))).toEqual(['ا']);
  });

  it('leaves the Mushaf row out without the app’s text', () => {
    const text = allText(
      render(<RasmSection rasm={unit([hadhf])} uthmani={undefined} />).toJSON(),
    );
    expect(text).not.toContain('Mushaf');
    expect(text).toContain('Standard');
  });

  it('names each kind', () => {
    const kinds = ['ziyada', 'badal', 'hamz', 'fasl'] as const;
    const text = allText(
      render(
        <RasmSection
          rasm={unit(
            kinds.map(kind => ({
              kind,
              standard: kind === 'ziyada' ? '' : 'ئ',
              mushaf: kind === 'fasl' ? '' : 'ء',
              mark: null,
              basis: 'sign' as const,
            })),
          )}
          uthmani="مَـٰلِكِ"
        />,
      ).toJSON(),
    );
    expect(text).toContain(
      `Added (ziyādah): The mushaf writes an extra ${FSI}«ء»${PDI}.`,
    );
    expect(text).toContain(
      `Substituted (badal): ${FSI}«ئ»${PDI} is written as ${FSI}«ء»${PDI} in the mushaf.`,
    );
    expect(text).toContain(
      `Hamza (hamz): The hamza is written ${FSI}«ء»${PDI} in the mushaf and ${FSI}«ئ»${PDI} in the standard spelling.`,
    );
    expect(text).toContain('Separated (faṣl): Written apart in the mushaf');
  });
});
