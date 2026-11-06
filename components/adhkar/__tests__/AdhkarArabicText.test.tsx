import React from 'react';
import {Text} from 'react-native';
import TestRenderer, {act, type ReactTestRenderer} from 'react-test-renderer';
import adhkarData from '@/data/adhkar.json';
import {AdhkarArabicText} from '../AdhkarArabicText';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {text: '#111111', textSecondary: '#666666'},
    },
  }),
}));

jest.mock('../AdhkarQuranPassage', () => {
  const {Text: MockText} = jest.requireActual('react-native');
  return {
    AdhkarQuranPassage: ({
      span,
      fallbackText,
      textAlign,
    }: {
      span: {surah: number; ayahFrom: number};
      fallbackText: string;
      textAlign: string;
    }) => (
      <MockText
        testID={`quran-${span.surah}:${span.ayahFrom}`}
        nativeID={`align-${textAlign}`}>
        {fallbackText}
      </MockText>
    ),
  };
});

// The renderer's own React types differ from the app's.
const TEXT = Text as never;

function arabicOf(id: string): string {
  const row = adhkarData.adhkar.find(r => r.id === id);
  if (!row) throw new Error(`row ${id} missing`);
  return row.arabic;
}

function render(id: string, align?: 'center' | 'right'): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <AdhkarArabicText
        dhikrId={id}
        arabic={arabicOf(id)}
        fontSize={20}
        style={{fontSize: 20, color: '#111111'}}
        align={align}
      />,
    );
  });
  if (!renderer) throw new Error('not rendered');
  return renderer;
}

function quranBlocks(renderer: ReactTestRenderer, id: string): number {
  return renderer.root
    .findAll(node => node.type === TEXT)
    .filter(node => node.props.testID === `quran-${id}`).length;
}

function quranAligns(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll(node => node.type === TEXT)
    .filter(node => typeof node.props.nativeID === 'string')
    .map(node => node.props.nativeID);
}

function spanStyles(renderer: ReactTestRenderer): Array<{
  text: string;
  fontSize: number;
  color: string;
}> {
  return renderer.root
    .findAll(node => node.type === TEXT)
    .filter(node => typeof node.props.children === 'string' && node.props.style)
    .map(node => ({
      text: String(node.props.children).trim(),
      fontSize: node.props.style.fontSize,
      color: node.props.style.color,
    }));
}

describe('AdhkarArabicText', () => {
  it('renders one text block with muted narration and no marks (row 20)', () => {
    const renderer = render('20');
    const outer = renderer.root
      .findAll(node => node.type === TEXT)
      .filter(node => typeof node.props.children !== 'string');
    expect(outer).toHaveLength(1);
    const spans = spanStyles(renderer);
    expect(spans.map(s => [s.fontSize, s.color])).toEqual([
      [16, '#666666'],
      [20, '#111111'],
      [20, 'rgba(17, 17, 17, 0.75)'],
      [20, 'rgba(17, 17, 17, 0.75)'],
      [20, '#111111'],
    ]);
    for (const span of spans) expect(span.text).not.toMatch(/\(\(|\)\)|\[|\]/);
  });

  it('draws a quranic dua as a Quran block', () => {
    const renderer = render('quranic-1');
    expect(quranBlocks(renderer, '2:127')).toBe(1);
  });

  it('keeps the isti`adha as text before Ayat al-Kursi (row 75)', () => {
    const renderer = render('75');
    expect(quranBlocks(renderer, '2:255')).toBe(1);
    const texts = spanStyles(renderer);
    expect(texts).toHaveLength(1);
    expect(texts[0].text.startsWith('أَعُوذُ')).toBe(true);
  });

  it('right-aligns Quran blocks by default and centers them on request', () => {
    expect(quranAligns(render('quranic-1'))).toEqual(['align-right']);
    expect(quranAligns(render('76', 'center'))).toEqual([
      'align-center',
      'align-center',
      'align-center',
    ]);
  });
});
