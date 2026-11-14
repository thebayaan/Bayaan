// @ai-generated
/**
 * Mushaf 1440 words <-> the DigitalKhatt (Hafs) page model the shared
 * overlays are computed on, on all 604 pages with the bundled DBs: every word
 * maps both ways, a verse highlighted on the DigitalKhatt lines lights exactly
 * that verse's words on the 1441H lines, and basmala lines pair up.
 */
import * as path from 'path';
import type {DKLine, DKWordInfo} from '../DigitalKhattDataService';
import {getLineWordSpans, type WordSlotSource} from '../lineWordSpans';
import {basmalaLineSurahs, layoutLineKey} from '../RewayahBasmalaService';
import {qcfDataService} from '../QCFDataService';
import {
  buildQCFDkPageMap,
  mapDkCharColorsToQCFWords,
  mapDkHighlightsToQCF,
} from '../qcfDkWordMap';
import {hasNodeSqlite} from '../__fixtures__/bundledDkSqlite';

const DK_DIR = path.join(process.cwd(), 'data/mushaf/digitalkhatt');

interface SqliteDb {
  prepare(sql: string): {all(): Record<string, unknown>[]};
  close(): void;
}

function openDb(name: string): SqliteDb {
  const {DatabaseSync} = require('node:sqlite') as {
    DatabaseSync: new (file: string, options: object) => SqliteDb;
  };
  return new DatabaseSync(path.join(DK_DIR, name), {readOnly: true});
}

const describeWithSqlite = hasNodeSqlite() ? describe : describe.skip;

describeWithSqlite('Mushaf 1440 <-> DigitalKhatt word map (all pages)', () => {
  let linesByPage: Map<number, DKLine[]>;
  let source: WordSlotSource;
  let basmalaSurahOf: (line: DKLine) => number | null;

  beforeAll(() => {
    const layout = openDb('digital-khatt-15-lines.db');
    const rows = layout
      .prepare(
        'SELECT page_number, line_number, line_type, is_centered, first_word_id, last_word_id, surah_number FROM pages ORDER BY page_number, line_number',
      )
      .all() as unknown as DKLine[];
    layout.close();
    linesByPage = new Map();
    for (const row of rows) {
      const lines = linesByPage.get(row.page_number) ?? [];
      lines.push(row);
      linesByPage.set(row.page_number, lines);
    }
    const surahs = basmalaLineSurahs(rows);
    basmalaSurahOf = line =>
      surahs.get(layoutLineKey(line.page_number, line.line_number)) ?? null;

    const words = openDb('digital-khatt-v2.db');
    const texts = new Map<number, string>();
    const infos = new Map<number, DKWordInfo>();
    for (const row of words
      .prepare('SELECT id, location, text FROM words')
      .all()) {
      const id = Number(row.id);
      const [surah, ayah, position] = String(row.location).split(':');
      texts.set(id, String(row.text));
      infos.set(id, {
        text: String(row.text),
        verseKey: `${surah}:${ayah}`,
        wordPositionInVerse: Number(position),
      });
    }
    words.close();
    source = {
      getWordText: id => texts.get(id) ?? '',
      getWordInfo: id => infos.get(id),
    };
  });

  it('maps every word of every page both ways', () => {
    for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
      const page = qcfDataService.getPage(pageNumber);
      const dkLines = linesByPage.get(pageNumber)!;
      const map = buildQCFDkPageMap(page, dkLines, source, basmalaSurahOf);
      for (const line of page.lines) {
        for (const word of line.words) {
          const slot = map.slotOf(word.id);
          expect(slot).toBeDefined();
          expect(source.getWordInfo(word.id)?.verseKey).toBe(word.verseKey);
        }
      }
      dkLines.forEach(line => {
        for (const span of getLineWordSpans(line, source)) {
          expect(map.placeOf(span.wordId)).toBeDefined();
        }
      });
    }
  });

  it('lights exactly a verse’s words when the shared layers paint it', () => {
    for (let pageNumber = 1; pageNumber <= 604; pageNumber += 7) {
      const page = qcfDataService.getPage(pageNumber);
      const dkLines = linesByPage.get(pageNumber)!;
      const map = buildQCFDkPageMap(page, dkLines, source, basmalaSurahOf);
      for (const verseKey of qcfDataService.getOrderedVerseKeysForPage(
        pageNumber,
      )) {
        // The verse's segment on each DigitalKhatt line, as the verse map
        // service gives it: first to last character of its words.
        const highlights = new Map<
          number,
          Array<{start: number; end: number; color: string}>
        >();
        dkLines.forEach((line, lineIndex) => {
          const spans = getLineWordSpans(line, source).filter(
            span => span.info.verseKey === verseKey,
          );
          if (spans.length === 0) return;
          highlights.set(lineIndex, [
            {
              start: spans[0].start,
              end: spans[spans.length - 1].end,
              color: 'red',
            },
          ]);
        });
        const mapped = mapDkHighlightsToQCF(highlights, map);
        const lit = new Set<number>();
        for (const [lineIndex, {runs}] of mapped) {
          const words = page.lines[lineIndex].words;
          for (const run of runs) {
            for (let i = run.firstWord; i <= run.lastWord; i++) {
              lit.add(words[i].id);
            }
          }
          // One run per line: a verse's words are consecutive.
          expect(runs).toHaveLength(1);
        }
        const expected = page.lines.flatMap(line =>
          line.words.filter(w => w.verseKey === verseKey).map(w => w.id),
        );
        expect([...lit].sort((a, b) => a - b)).toEqual(expected);
      }
    }
  });

  it('pairs every basmala line with its DigitalKhatt basmala', () => {
    let pairs = 0;
    for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
      const page = qcfDataService.getPage(pageNumber);
      const dkLines = linesByPage.get(pageNumber)!;
      const map = buildQCFDkPageMap(page, dkLines, source, basmalaSurahOf);
      page.lines.forEach((line, lineIndex) => {
        if (line.kind !== 'basmallah') return;
        const dkLine = map.dkBasmalaLineOf(lineIndex);
        expect(dkLine).toBeDefined();
        expect(map.basmalaLineOf(dkLine!)).toBe(lineIndex);
        const lit = mapDkHighlightsToQCF(
          new Map([[dkLine!, [{start: 0, end: 10, color: 'gold'}]]]),
          map,
        );
        expect(lit.get(lineIndex)?.wholeLine).toEqual(['gold']);
        pairs++;
      });
    }
    // 114 surahs, less Al-Fatiha (its basmala is ayah 1) and At-Tawbah.
    expect(pairs).toBe(112);
  });

  it('colours a whole word when some of its letters are coloured', () => {
    const dkLines = linesByPage.get(1)!;
    const spans = getLineWordSpans(dkLines[1], source);
    // Two letters of the second word (ٱللَّهِ) only.
    const colours = new Map<number, string>([
      [spans[1].start + 2, '#d4a017'],
      [spans[1].start + 3, '#d4a017'],
    ]);
    const lineColors = dkLines.map((_, i) => (i === 1 ? colours : null));
    const byWord = mapDkCharColorsToQCFWords(lineColors, dkLines, source);
    expect([...byWord]).toEqual([[spans[1].wordId, '#d4a017']]);
  });
});
