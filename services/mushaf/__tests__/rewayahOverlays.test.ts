/**
 * Overlay walkers on the shared span model, against real slot texts from the
 * Hafs / Shu'bah DBs and Release-1 slot-model rewayah DBs (fixture generated
 * by services/mushaf/__fixtures__/gen_rewayah_overlay_fixture.py).
 *
 * DigitalKhattDataService is replaced by a fixture-backed stand-in whose text
 * joins are the same lineWordSpans helpers the real service delegates to.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../DigitalKhattDataService', () => {
  const actual = jest.requireActual('../DigitalKhattDataService');
  const {createFakeDKService} = jest.requireActual(
    '../__fixtures__/rewayahOverlayFixture',
  );
  return {
    ...actual,
    digitalKhattDataService: createFakeDKService(actual.BASMALLAH_TEXT),
  };
});

// Diff files are swapped per test through these mutable module objects.
const mockDiffAssets: Record<string, Record<string, unknown>> = {
  warsh: {},
  'al-bazzi': {},
  'al-susi': {},
  shubah: {},
};
jest.mock(
  '@/data/mushaf/digitalkhatt/warsh-diff.json',
  () => mockDiffAssets.warsh,
);
jest.mock(
  '@/data/mushaf/digitalkhatt/bazzi-diff.json',
  () => mockDiffAssets['al-bazzi'],
);
jest.mock(
  '@/data/mushaf/digitalkhatt/soosi-diff.json',
  () => mockDiffAssets['al-susi'],
);
jest.mock(
  '@/data/mushaf/digitalkhatt/shouba-diff.json',
  () => mockDiffAssets.shubah,
);

import {
  BASMALLAH_TEXT,
  digitalKhattDataService,
  type DKWordInfo,
} from '../DigitalKhattDataService';
import {mushafVerseMapService} from '../MushafVerseMapService';
import {
  getLineAllahNameCharMap,
  getTextAllahNameCharMap,
} from '../AllahNameHighlightService';
import {getLineTajweedMap} from '../TajweedMappingService';
import {
  clearVerseTajweedCache,
  getVerseTajweedMap,
} from '../DigitalKhattVerseTajweedService';
import {alignWordTajweed, detectWordTafkhim} from '../TajweedAlignmentService';
import {rewayahDiffService} from '../RewayahDiffService';
import {getLineWordSpans, layoutWords, wholeWordText} from '../lineWordSpans';
import {
  FIXTURE_DBS,
  expectedSpans,
  findPage,
  fixture,
  type FakeDKService,
  type FixtureDb,
  type FixturePage,
} from '../__fixtures__/rewayahOverlayFixture';
import {
  computeLineCharRuleMaps,
  computeLineTajweedMaps,
  computePageDiffBackgrounds,
  isRewayahDiffPaintEnabled,
  isTajweedEnabled,
} from '@/components/mushaf/skia/pageOverlays';
import {
  computeVerseCharRuleMap,
  computeVerseDiffRanges,
} from '@/components/player/v2/PlayerContent/QuranView/verseOverlays';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const dk = digitalKhattDataService as unknown as FakeDKService;
const tajweed = fixture.tajweed;
// U+06E5 / U+06E6 small high waw / yeh (silah marks)
const SILAH_MARKS = [String.fromCharCode(0x06e5), String.fromCharCode(0x06e6)];

function setDiff(rewayah: RewayahId, content: Record<string, unknown>): void {
  const target = mockDiffAssets[rewayah];
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, content);
}

function ayahLines(page: FixturePage) {
  return page.expected.hafs.map(l => l.lineIndex);
}

function lineText(page: FixturePage, lineIndex: number): string {
  return dk.getLineText(dk.getPageLines(page.page)[lineIndex]);
}

function sortedKeys(map: Map<number, string> | null): number[] {
  return map ? [...map.keys()].sort((a, b) => a - b) : [];
}

/** Pre-span-model line walker (word ids, +1 separator per id): the shape of
 *  the old TajweedMappingService / AllahNameHighlightService loops. */
function legacyLineWords(page: FixturePage, lineIndex: number) {
  const line = dk.getPageLines(page.page)[lineIndex];
  const out: {info: DKWordInfo; offset: number}[] = [];
  let offset = 0;
  for (let id = line.first_word_id; id <= line.last_word_id; id++) {
    const info = dk.getWordInfo(id)!;
    out.push({info, offset});
    offset += info.text.length;
    if (id < line.last_word_id) offset += 1;
  }
  return out;
}

describe('MushafVerseMapService (verse segments / hit-testing)', () => {
  for (const db of FIXTURE_DBS) {
    it(`${db}: segments equal the expected layout on every fixture line`, () => {
      dk.load(db);
      for (const page of fixture.pages) {
        for (const expected of page.expected[db]) {
          const segments = mushafVerseMapService
            .getVerseSegments(page.page, expected.lineIndex)
            .map(s => [
              s.verseKey,
              s.startCharIndex,
              s.endCharIndex,
              s.firstWordId,
              s.lastWordId,
            ]);
          expect(segments).toEqual(expected.segments);

          // every character of every slot hit-tests to that slot's verse
          for (const span of expectedSpans(page, db, expected)) {
            const location = page.locations[span.wordId - page.firstWordId];
            const verseKey = location.split(':').slice(0, 2).join(':');
            // (a marker-only slot has wordEnd = start - 1: no word part)
            const probes = [span.start, span.end];
            if (span.wordEnd >= span.start) probes.push(span.wordEnd);
            for (const index of probes) {
              expect(
                mushafVerseMapService.findVerseAtCharIndex(
                  page.page,
                  expected.lineIndex,
                  index,
                )?.verseKey,
              ).toBe(verseKey);
            }
          }
        }
      }
    });
  }

  it('Hafs: only page 451 line 2 (37:130:3 slot) differs from the old wordInfos pairing', () => {
    dk.load('hafs');
    const changed: string[] = [];
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const text = lineText(page, lineIndex);
        // old algorithm: pair word id N with the N-th space-separated token
        const tokens: {start: number; end: number}[] = [];
        let start = 0;
        for (const token of text.split(' ')) {
          tokens.push({start, end: start + token.length - 1});
          start += token.length + 1;
        }
        const old: [string, number, number][] = [];
        legacyLineWords(page, lineIndex).forEach(({info}, i) => {
          const token = tokens[i];
          if (!token) return;
          const last = old[old.length - 1];
          if (last && last[0] === info.verseKey) last[2] = token.end;
          else old.push([info.verseKey, token.start, token.end]);
        });
        const current = mushafVerseMapService
          .getVerseSegments(page.page, lineIndex)
          .map(s => [s.verseKey, s.startCharIndex, s.endCharIndex]);
        if (JSON.stringify(old) !== JSON.stringify(current)) {
          changed.push(`${page.page}:${lineIndex}`);
        }
      }
    }
    expect(changed).toEqual(['451:1']);
    // and the fixed segments: 37:130 covers 'إِلْ يَاسِينَ ۝١٣٠', 37:131 is tappable
    const segments = mushafVerseMapService.getVerseSegments(451, 1);
    const page = findPage(451);
    const text = lineText(page, 1);
    const s130 = segments.find(s => s.verseKey === '37:130')!;
    expect(text.slice(s130.startCharIndex, s130.endCharIndex + 1)).toContain(
      page.texts.hafs[61958 - page.firstWordId],
    );
    expect(segments.map(s => s.verseKey)).toContain('37:131');
  });

  it('drops cached segments when the rewayah or the words cache changes', () => {
    const page = findPage(1);
    dk.load('hafs');
    const hafs = mushafVerseMapService.getVerseSegments(1, 1);
    expect(hafs.map(s => s.verseKey)).toEqual(['1:1']);
    const hafsOrder = mushafVerseMapService.getOrderedVerseKeysForPage(1);

    dk.load('warsh');
    const expected = page.expected.warsh.find(l => l.lineIndex === 1)!;
    expect(
      mushafVerseMapService
        .getVerseSegments(1, 1)
        .map(s => [s.verseKey, s.startCharIndex, s.endCharIndex]),
    ).toEqual(expected.segments.map(s => s.slice(0, 3)));
    expect(mushafVerseMapService.getVerseSegments(1, 1)).not.toBe(hafs);
    expect(mushafVerseMapService.getOrderedVerseKeysForPage(1)).not.toBe(
      hafsOrder,
    );

    // same rewayah, new data (cache version bump) also recomputes
    const before = mushafVerseMapService.getVerseSegments(1, 2);
    dk.bumpVersion();
    const after = mushafVerseMapService.getVerseSegments(1, 2);
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
  });
});

describe('AllahNameHighlightService.getLineAllahNameCharMap', () => {
  for (const db of FIXTURE_DBS) {
    it(`${db}: matches the token-level map of the rendered line text`, () => {
      dk.load(db);
      for (const page of fixture.pages) {
        for (const lineIndex of ayahLines(page)) {
          const text = lineText(page, lineIndex);
          const lineMap = getLineAllahNameCharMap(page.page, lineIndex);
          expect(lineMap).toEqual(getTextAllahNameCharMap(text));
          for (const index of sortedKeys(lineMap)) {
            expect(text[index]).not.toBe(' ');
          }
        }
      }
    });
  }

  it('Hafs: identical to the old word-id walker on every fixture line', () => {
    dk.load('hafs');
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const old = new Map<number, string>();
        for (const {info, offset} of legacyLineWords(page, lineIndex)) {
          const wordMap = getTextAllahNameCharMap(info.text);
          wordMap?.forEach((v, k) => old.set(offset + k, v));
        }
        expect(getLineAllahNameCharMap(page.page, lineIndex)).toEqual(
          old.size > 0 ? old : null,
        );
      }
    }
  });

  it('basmallah and surah-name lines', () => {
    dk.load('warsh');
    expect(getLineAllahNameCharMap(2, 1)).toEqual(
      getTextAllahNameCharMap(BASMALLAH_TEXT),
    );
    expect(getLineAllahNameCharMap(2, 0)).toBeNull();
    expect(getLineAllahNameCharMap(2, 99)).toBeNull();
  });
});

describe('TajweedMappingService.getLineTajweedMap (Hafs QPC data)', () => {
  it('Hafs: identical to the old word-id walker on every fixture line', () => {
    dk.load('hafs');
    let colored = 0;
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const old = new Map<number, string>();
        for (const {info, offset} of legacyLineWords(page, lineIndex)) {
          const words = tajweed[info.verseKey];
          if (!words) continue;
          const tw = words.find(
            w => Number(w.location.split(':')[2]) === info.wordPositionInVerse,
          );
          const rules = tw
            ? alignWordTajweed(info.text, tw.segments)
            : detectWordTafkhim(info.text);
          rules?.forEach((rule, i) => old.set(offset + i, rule));
        }
        const current = getLineTajweedMap(page.page, lineIndex, tajweed);
        expect(current).toEqual(old.size > 0 ? old : null);
        colored += current?.size ?? 0;
      }
    }
    expect(colored).toBeGreaterThan(1000);
  });

  it('never paints Hafs tajweed on non-Hafs text', () => {
    for (const db of FIXTURE_DBS.filter(d => d !== 'hafs')) {
      dk.load(db);
      for (const page of fixture.pages) {
        for (const lineIndex of ayahLines(page)) {
          expect(getLineTajweedMap(page.page, lineIndex, tajweed)).toBeNull();
        }
      }
    }
  });
});

describe('DigitalKhattVerseTajweedService.getVerseTajweedMap', () => {
  beforeEach(() => clearVerseTajweedCache());

  it('maps onto the joined verse text (Hafs)', () => {
    dk.load('hafs');
    for (const verseKey of ['1:2', '1:7', '37:130', '2:2']) {
      const words = dk.getVerseWords(verseKey);
      const text = layoutWords(words).text;
      const map = getVerseTajweedMap(verseKey, tajweed)!;
      expect(map).not.toBeNull();
      // same rules as aligning each word at its span start
      const expected = new Map<number, string>();
      for (const span of layoutWords(words).spans) {
        const tw = tajweed[verseKey].find(
          w =>
            Number(w.location.split(':')[2]) === span.item.wordPositionInVerse,
        );
        const rules = tw
          ? alignWordTajweed(span.text, tw.segments)
          : detectWordTafkhim(span.text);
        rules?.forEach((rule, i) => expected.set(span.start + i, rule));
      }
      expect(map).toEqual(expected);
      for (const index of map.keys()) expect(text[index]).not.toBe(' ');
    }
  });

  it('returns null for non-Hafs text and uses the words it is given', () => {
    dk.load('warsh');
    expect(getVerseTajweedMap('1:2', tajweed)).toBeNull();
    expect(
      getVerseTajweedMap('1:2', tajweed, {
        rewayah: 'warsh',
        words: dk.getVerseWords('1:2'),
      }),
    ).toBeNull();

    // player: Hafs track while the mushaf is Warsh -> Hafs words passed in
    const page = findPage(1);
    const hafsWords: DKWordInfo[] = page.locations
      .map((location, i) => ({location, text: page.texts.hafs[i]}))
      .filter(({location}) => location.startsWith('1:2:'))
      .map(({location, text}) => ({
        text,
        verseKey: '1:2',
        wordPositionInVerse: Number(location.split(':')[2]),
      }));
    const map = getVerseTajweedMap('1:2', tajweed, {
      rewayah: 'hafs',
      words: hafsWords,
    });
    expect(map).not.toBeNull();
    const text = layoutWords(hafsWords).text;
    for (const index of map!.keys()) expect(index).toBeLessThan(text.length);
  });

  it('is invalidated by the words-cache version and never caches an empty verse', () => {
    dk.load('hafs');
    expect(getVerseTajweedMap('1:2', tajweed, {words: []})).toBeNull();
    const first = getVerseTajweedMap('1:2', tajweed);
    expect(first).not.toBeNull();
    expect(getVerseTajweedMap('1:2', tajweed)).toBe(first);
    dk.bumpVersion();
    const second = getVerseTajweedMap('1:2', tajweed);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});

describe('RewayahDiffService', () => {
  afterEach(() => {
    rewayahDiffService.loadForRewayah('hafs');
  });

  function checkLineRanges(db: FixtureDb, flagged: (key: string) => boolean) {
    let ranges = 0;
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const text = lineText(page, lineIndex);
        const spans = getLineWordSpans(
          dk.getPageLines(page.page)[lineIndex],
          dk,
        );
        for (const range of rewayahDiffService.getDiffRangesForLine(
          page.page,
          lineIndex,
        )) {
          const span = spans.find(s => s.start === range.start)!;
          expect(span).toBeDefined();
          expect(range.end).toBe(span.wordEnd);
          expect(text.slice(range.start, range.end + 1)).toBe(
            wholeWordText(span.text),
          );
          expect(
            flagged(`${span.info.verseKey}:${span.info.wordPositionInVerse}`),
          ).toBe(true);
          ranges++;
        }
      }
    }
    expect(ranges).toBeGreaterThan(0);
    return db;
  }

  function entriesOf(file: Record<string, unknown>, category: string) {
    const out = new Map<string, number[]>();
    for (const [verseKey, value] of Object.entries(file)) {
      if (verseKey.startsWith('__') || !value || Array.isArray(value)) continue;
      const entries = (value as Record<string, [number, number[]][]>)[category];
      for (const [pos, chars] of entries ?? []) {
        out.set(`${verseKey}:${pos}`, chars);
      }
    }
    return out;
  }

  it('format 2: skips "__format", tints whole words without the inline marker', () => {
    const file = fixture.diffs.format2.warsh;
    setDiff('warsh', file);
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    expect(rewayahDiffService.diffFormat).toBe(2);
    expect(rewayahDiffService.hasCategory('mukhtalif')).toBe(true);
    expect(rewayahDiffService.hasCategory('tashil')).toBe(false);
    const mukhtalif = entriesOf(file, 'mukhtalif');
    checkLineRanges('warsh', key => mukhtalif.has(key));

    // 7:137:18 'إِس۟رَآءِيلَ ۝١٣٦' carries an inline marker and is flagged
    const page = findPage(166);
    const lineIndex = page.expected.warsh.find(l =>
      expectedSpans(page, 'warsh', l).some(s => s.wordId === 22364),
    )!.lineIndex;
    const spans = getLineWordSpans(dk.getPageLines(166)[lineIndex], dk);
    const slot = spans.find(s => s.wordId === 22364)!;
    expect(slot.wordEnd).toBeLessThan(slot.end);
    const range = rewayahDiffService
      .getDiffRangesForLine(166, lineIndex)
      .find(r => r.start === slot.start)!;
    expect(range.end).toBe(slot.wordEnd);
  });

  it('format 2: silah comes only from the explicit entries', () => {
    const file = fixture.diffs.format2.bazzi;
    setDiff('al-bazzi', file);
    dk.load('bazzi');
    rewayahDiffService.loadForRewayah('al-bazzi');
    expect(rewayahDiffService.hasSilahColoring).toBe(true);
    const silah = entriesOf(file, 'silah');
    let explicit = 0;
    let unlisted = 0;
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const painted = new Set(
          rewayahDiffService.getSilahCharsForLine(page.page, lineIndex),
        );
        const ruleMap = rewayahDiffService.getRewayahRuleMapForLine(
          page.page,
          lineIndex,
        );
        // format 2 Release-1 data: no letter-level category, silah only
        for (const rule of ruleMap?.values() ?? []) expect(rule).toBe('silah');
        const spans = getLineWordSpans(
          dk.getPageLines(page.page)[lineIndex],
          dk,
        );
        for (const span of spans) {
          const key = `${span.info.verseKey}:${span.info.wordPositionInVerse}`;
          const chars = silah.get(key);
          const spanPainted = [...painted].filter(
            i => i >= span.start && i <= span.end,
          );
          if (chars) {
            expect(spanPainted.sort((a, b) => a - b)).toEqual(
              chars.map(c => span.start + c).sort((a, b) => a - b),
            );
            explicit++;
          } else {
            expect(spanPainted).toEqual([]);
            if (SILAH_MARKS.some(m => span.text.includes(m))) unlisted++;
          }
        }
      }
    }
    expect(explicit).toBeGreaterThan(0);
    // slots whose silah equals Hafs carry the mark but are not painted
    expect(unlisted).toBeGreaterThan(0);
  });

  it('legacy file (no "__format"): letter-level categories and scanned silah', () => {
    const file = fixture.diffs.legacy.warsh;
    setDiff('warsh', file);
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    expect(rewayahDiffService.diffFormat).toBeNull();
    expect(rewayahDiffService.hasSilahColoring).toBe(true);
    const tashil = entriesOf(file, 'tashil');
    let tashilChars = 0;
    let silahChars = 0;
    for (const page of fixture.pages) {
      for (const lineIndex of ayahLines(page)) {
        const text = lineText(page, lineIndex);
        const spans = getLineWordSpans(
          dk.getPageLines(page.page)[lineIndex],
          dk,
        );
        for (const index of rewayahDiffService.getCharsForCategory(
          'tashil',
          page.page,
          lineIndex,
        )) {
          const span = spans.find(s => index >= s.start && index <= s.wordEnd)!;
          const chars = tashil.get(
            `${span.info.verseKey}:${span.info.wordPositionInVerse}`,
          )!;
          expect(chars).toContain(index - span.start);
          tashilChars++;
        }
        for (const index of rewayahDiffService.getSilahCharsForLine(
          page.page,
          lineIndex,
        )) {
          const ch = text[index];
          const next = text[index + 1];
          expect(SILAH_MARKS.includes(ch) || SILAH_MARKS.includes(next)).toBe(
            true,
          );
          silahChars++;
        }
      }
    }
    expect(tashilChars).toBeGreaterThan(0);
    expect(silahChars).toBeGreaterThan(0);
  });

  it('legacy flat Shubah arrays are whole-word major', () => {
    setDiff('shubah', {'37:130': [3]});
    dk.load('shouba');
    rewayahDiffService.loadForRewayah('shubah');
    const page = findPage(451);
    const spans = getLineWordSpans(dk.getPageLines(451)[1], dk);
    const slot = spans.find(s => s.wordId === 61958)!;
    expect(rewayahDiffService.getDiffRangesForLine(451, 1)).toEqual([
      {start: slot.start, end: slot.end},
    ]);
    // the multi-token slot is tinted as one unit, spaces included
    expect(lineText(page, 1).slice(slot.start, slot.end + 1)).toBe(slot.text);
  });

  it('verse-level ranges and rules index into the joined verse text', () => {
    setDiff('warsh', fixture.diffs.format2.warsh);
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    const words = dk.getVerseWords('7:137');
    const withBlank = [
      ...words.slice(0, 3),
      {...words[3], text: ''},
      ...words.slice(3),
    ];
    const {text, spans} = layoutWords(withBlank);
    const ranges = rewayahDiffService.getDiffRangesForWords(withBlank, 'warsh');
    expect(ranges.length).toBeGreaterThan(0);
    for (const range of ranges) {
      const span = spans.find(s => s.start === range.start)!;
      expect(text.slice(range.start, range.end + 1)).toBe(
        wholeWordText(span.text),
      );
    }
    // the words belong to another rewayah than the loaded diff data
    expect(rewayahDiffService.getDiffRangesForWords(words, 'qalun')).toEqual(
      [],
    );
    expect(
      rewayahDiffService.getRewayahRuleMapForWords(words, 'qalun'),
    ).toBeNull();
  });

  it("never projects one rewayah's positions onto another rewayah's text", () => {
    setDiff('warsh', fixture.diffs.format2.warsh);
    rewayahDiffService.loadForRewayah('warsh');
    dk.load('hafs');
    for (const page of fixture.pages) {
      expect(
        rewayahDiffService.getPageDiffHighlightsByLine(page.page).size,
      ).toBe(0);
      for (const lineIndex of ayahLines(page)) {
        expect(
          rewayahDiffService.getRewayahRuleMapForLine(page.page, lineIndex),
        ).toBeNull();
      }
    }
  });

  it('line caches follow the words-cache version', () => {
    setDiff('al-susi', fixture.diffs.format2.soosi);
    dk.load('soosi');
    rewayahDiffService.loadForRewayah('al-susi');
    // 72:16:1 'وَأَن لَّوِ' (two words in one Hafs slot) is a Soosi variant
    const page = findPage(573);
    const lineIndex = ayahLines(page).find(
      i => rewayahDiffService.getDiffRangesForLine(573, i).length > 0,
    )!;
    expect(lineIndex).toBeDefined();
    const before = rewayahDiffService.getDiffRangesForLine(573, lineIndex);
    expect(rewayahDiffService.getDiffRangesForLine(573, lineIndex)).toBe(
      before,
    );
    dk.bumpVersion();
    const after = rewayahDiffService.getDiffRangesForLine(573, lineIndex);
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
    // the multi-token slot is one tinted unit
    const spans = getLineWordSpans(dk.getPageLines(573)[lineIndex], dk);
    const slot = spans.find(s => s.wordId === 79411)!;
    expect(slot.text.split(' ')).toHaveLength(2);
    expect(after).toContainEqual({start: slot.start, end: slot.wordEnd});
  });
});

describe("page overlays: 'Show differences' and the Hafs-only tajweed gate", () => {
  afterEach(() => rewayahDiffService.loadForRewayah('hafs'));

  it('gates', () => {
    expect(isTajweedEnabled(true, 'hafs')).toBe(true);
    expect(isTajweedEnabled(true, 'warsh')).toBe(false);
    expect(isTajweedEnabled(true, 'shubah')).toBe(false);
    expect(isTajweedEnabled(false, 'hafs')).toBe(false);
    expect(isRewayahDiffPaintEnabled(true, 'warsh')).toBe(true);
    expect(isRewayahDiffPaintEnabled(false, 'warsh')).toBe(false);
    expect(isRewayahDiffPaintEnabled(true, 'hafs')).toBe(false);
  });

  it('OFF paints no rewayah foreground or background at all', () => {
    setDiff('warsh', fixture.diffs.legacy.warsh); // tashil + scanned silah
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    for (const page of fixture.pages) {
      const n = dk.getPageLines(page.page).length;
      const paint = isRewayahDiffPaintEnabled(false, dk.rewayah);
      expect(computeLineCharRuleMaps(page.page, n, null, paint)).toBeNull();
      expect(computePageDiffBackgrounds(page.page, paint).size).toBe(0);
      // tajweed is off for Warsh text even with the tajweed setting on
      expect(
        computeLineTajweedMaps(
          page.page,
          n,
          tajweed,
          isTajweedEnabled(true, dk.rewayah),
        ),
      ).toBeNull();
    }
  });

  it('ON paints the rewayah layers', () => {
    setDiff('warsh', fixture.diffs.legacy.warsh);
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    const rules = new Set<string>();
    let backgrounds = 0;
    for (const page of fixture.pages) {
      const n = dk.getPageLines(page.page).length;
      const maps = computeLineCharRuleMaps(page.page, n, null, true);
      for (const map of maps ?? []) map?.forEach(rule => rules.add(rule));
      backgrounds += computePageDiffBackgrounds(page.page, true).size;
    }
    for (const rule of rules) {
      expect(['ibdal', 'silah', 'tashil']).toContain(rule);
    }
    expect(rules.has('tashil')).toBe(true);
    expect(rules.has('silah')).toBe(true);
    expect(backgrounds).toBeGreaterThan(0);
  });

  it('Hafs keeps its tajweed; OFF leaves exactly the tajweed maps', () => {
    dk.load('hafs');
    for (const page of fixture.pages) {
      const n = dk.getPageLines(page.page).length;
      const tajweedMaps = computeLineTajweedMaps(
        page.page,
        n,
        tajweed,
        isTajweedEnabled(true, dk.rewayah),
      );
      expect(tajweedMaps).not.toBeNull();
      expect(computeLineCharRuleMaps(page.page, n, tajweedMaps, false)).toEqual(
        tajweedMaps,
      );
    }
  });
});

describe('verse overlays (list / reading / player)', () => {
  afterEach(() => rewayahDiffService.loadForRewayah('hafs'));

  it("'Show differences' gates fg and bg; tajweed only on Hafs text", () => {
    setDiff('warsh', fixture.diffs.legacy.warsh);
    dk.load('warsh');
    rewayahDiffService.loadForRewayah('warsh');
    const words = dk.getVerseWords('7:137');
    const base = {
      verseKey: '7:137',
      words,
      rewayah: 'warsh' as RewayahId,
      mushafRewayah: 'warsh' as RewayahId,
      showTajweed: true,
      indexedTajweedData: tajweed,
    };

    const off = computeVerseCharRuleMap({...base, showRewayahDiffs: false});
    expect(off).toBeNull(); // no tajweed on Warsh text, no rewayah paint
    expect(computeVerseDiffRanges({...base, showRewayahDiffs: false})).toEqual(
      [],
    );

    const on = computeVerseCharRuleMap({...base, showRewayahDiffs: true});
    expect(on).not.toBeNull();
    for (const rule of on!.values()) {
      expect(['tashil', 'ibdal', 'silah']).toContain(rule);
    }
    const ranges = computeVerseDiffRanges({...base, showRewayahDiffs: true});
    expect(ranges.length).toBeGreaterThan(0);
    const {text} = layoutWords(words);
    for (const range of ranges) {
      expect(text.slice(range.start, range.end + 1)).not.toMatch(
        new RegExp(`${String.fromCharCode(0x06dd)}|^ | $`),
      );
    }

    // a player track in another rewayah than the mushaf: no rewayah layers
    expect(
      computeVerseDiffRanges({
        ...base,
        mushafRewayah: 'qalun',
        showRewayahDiffs: true,
      }),
    ).toEqual([]);
  });

  it('Hafs text keeps tajweed in the verse view', () => {
    dk.load('hafs');
    const map = computeVerseCharRuleMap({
      verseKey: '1:2',
      words: dk.getVerseWords('1:2'),
      rewayah: 'hafs',
      mushafRewayah: 'hafs',
      showTajweed: true,
      indexedTajweedData: tajweed,
      showRewayahDiffs: true,
    });
    expect(map).not.toBeNull();
  });
});
