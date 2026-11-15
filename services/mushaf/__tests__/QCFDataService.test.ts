// @ai-generated
/**
 * The Mushaf 1440 pages (data/mushaf/qcf/qcf-pages.json): the 1441H print's
 * lines, every word of the Quran once and in order.
 */
import {qcfDataService, QCF_TOTAL_PAGES} from '../QCFDataService';

const pages = Array.from({length: QCF_TOTAL_PAGES}, (_, i) =>
  qcfDataService.getPage(i + 1),
);

describe('Mushaf 1440 pages', () => {
  it('holds every word of the Quran once, in reading order', () => {
    const ids = pages.flatMap(page =>
      page.lines.flatMap(line => line.words.map(word => word.id)),
    );
    expect(ids).toHaveLength(83668);
    ids.forEach((id, index) => expect(id).toBe(index + 1));
  });

  it('draws 15 lines on every page but the two opening ones', () => {
    for (const page of pages) {
      const expected = page.pageNumber <= 2 ? 8 : 15;
      expect(page.lines).toHaveLength(expected);
      page.lines.forEach((line, index) =>
        expect(line.lineNumber).toBe(index + 1),
      );
    }
  });

  it('opens every surah with its title, and a basmala but for At-Tawbah', () => {
    const titles: number[] = [];
    for (const page of pages) {
      page.lines.forEach((line, index) => {
        if (line.kind !== 'surah_name') return;
        const surah = line.surahNumber!;
        titles.push(surah);
        const next = page.lines[index + 1];
        if (surah === 1 || surah === 9) {
          // Al-Fatiha's basmala is its first ayah.
          expect(next.kind).toBe('ayah');
          expect(next.words[0].location).toBe(`${surah}:1:1`);
        } else {
          expect(next).toMatchObject({kind: 'basmallah', surahNumber: surah});
          expect(page.lines[index + 2].words[0].location).toBe(`${surah}:1:1`);
        }
      });
    }
    expect(titles).toEqual(Array.from({length: 114}, (_, i) => i + 1));
  });

  it('never ends a page on a title: 1441H opens the next page with it', () => {
    for (const page of pages) {
      expect(page.lines[page.lines.length - 1].kind).toBe('ayah');
    }
    // Luqman ends on page 414 with 15 lines; As-Sajdah's title opens 415.
    expect(
      qcfDataService.getPage(414).lines.every(l => l.kind === 'ayah'),
    ).toBe(true);
    expect(
      qcfDataService
        .getPage(415)
        .lines.slice(0, 2)
        .map(l => l.kind),
    ).toEqual(['surah_name', 'basmallah']);
  });

  it('centres the two opening pages and the print’s short lines', () => {
    const centred = pages.flatMap(page =>
      page.lines
        .filter(line => line.kind === 'ayah' && line.centered)
        .map(line => `${page.pageNumber}:${line.lineNumber}`),
    );
    expect(centred).toHaveLength(30);
    expect(centred).toEqual(
      expect.arrayContaining(['1:2', '2:8', '528:9', '604:15', '586:1']),
    );
  });

  it('gives each word its verse key and glyph code', () => {
    const [first] = qcfDataService.getPage(1).lines[1].words;
    expect(first).toEqual({
      id: 1,
      location: '1:1:1',
      verseKey: '1:1',
      code: 'ﱁ',
    });
  });

  it('lists a page’s verses and surahs in reading order', () => {
    expect(qcfDataService.getOrderedVerseKeysForPage(1)).toEqual([
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '1:5',
      '1:6',
      '1:7',
    ]);
    expect(qcfDataService.getSurahsOnPage(604)).toEqual([112, 113, 114]);
    expect(qcfDataService.getSurahsOnPage(414)).toEqual([31]);
    expect(qcfDataService.getSurahsOnPage(415)).toEqual([32]);
  });

  it('serves an empty page outside the mushaf', () => {
    expect(qcfDataService.getPage(0).lines).toHaveLength(0);
    expect(qcfDataService.getPage(605).lines).toHaveLength(0);
  });
});
