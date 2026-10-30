// @ai-generated
import type {Reciter, Rewayat} from '@/data/reciterData';
import {
  baseStyle,
  buildReciterSections,
  completeRewayat,
  hasCompleteQuran,
  recitationLabels,
} from '../reciterSections';

const ALL = Array.from({length: 114}, (_, i) => i + 1);

function rewayah(id: string, name: string, style: string, list = ALL) {
  return {id, name, style, surah_list: list} as unknown as Rewayat;
}

function reciter(id: string, name: string, rewayat: Rewayat[]): Reciter {
  return {id, name, date: null, image_url: null, rewayat};
}

const HAFS = "Hafs A'n Assem";

describe('completeRewayat', () => {
  it('keeps only rewayat with all 114 surahs', () => {
    const r = reciter('a', 'A', [
      rewayah('full', HAFS, 'murattal'),
      rewayah('part', HAFS, 'mojawwad', [1, 2, 3]),
      rewayah('gaps', HAFS, 'molim', [...ALL.slice(0, 113), null as never]),
    ]);
    expect(completeRewayat(r).map(x => x.id)).toEqual(['full']);
    expect(hasCompleteQuran(r)).toBe(true);
    expect(hasCompleteQuran(reciter('b', 'B', [r.rewayat[1]]))).toBe(false);
  });
});

describe('recitationLabels', () => {
  const style = (s: string) => s.toUpperCase();

  it('shows only the style when every recitation shares a rewayah', () => {
    const labels = recitationLabels(
      [rewayah('1', HAFS, 'murattal'), rewayah('2', HAFS, 'mojawwad2')],
      style,
    );
    expect(labels).toEqual(['MURATTAL', 'MOJAWWAD']);
  });

  it('leads with the rewayah when they differ', () => {
    const labels = recitationLabels(
      [rewayah('1', HAFS, 'murattal'), rewayah('2', 'Other', 'murattal')],
      style,
    );
    expect(labels[0]).toMatch(/· MURATTAL$/);
    expect(labels[1]).toBe('Other · MURATTAL');
  });

  it('strips the duplicate counter from styles', () => {
    expect(baseStyle('Murattal3')).toBe('murattal');
  });
});

describe('buildReciterSections', () => {
  const reciters = [
    reciter('1', 'Saad', []),
    reciter('2', 'abdul', []),
    reciter('3', 'Ahmed', []),
    reciter('4', '3abc', []),
    reciter('5', 'Ali', []),
  ];
  const name = (r: Reciter) => r.name;

  it('groups A–Z by first letter', () => {
    const sections = buildReciterSections(reciters, name, 1);
    expect(sections.map(s => s.title)).toEqual(['#', 'A', 'S']);
    expect(sections[1].data.map(row => row[0].name)).toEqual([
      'abdul',
      'Ahmed',
      'Ali',
    ]);
  });

  it('splits each group into rows for the grid', () => {
    const sections = buildReciterSections(reciters, name, 2);
    const a = sections.find(s => s.title === 'A');
    expect(a?.data.map(row => row.length)).toEqual([2, 1]);
  });
});
