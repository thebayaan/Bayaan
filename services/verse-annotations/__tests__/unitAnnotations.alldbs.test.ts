// @ai-generated
/**
 * LOCAL-ONLY: bookmarks, notes, highlights, mushaf search and verse links on
 * every verse of every words DB (skipped unless BAYAAN_OVERLAY_DB_DIR is
 * set; needs node:sqlite):
 *
 *   BAYAAN_OVERLAY_DB_DIR=/path/to/dbs npx jest unitAnnotations.alldbs --watchAll=false
 *
 * For every verse unit of every rewayah it asserts:
 *  - the row stored for it (Hafs anchor + rewayah) opens, labels and
 *    previews exactly that verse (route anchor, collection label, own text);
 *  - one row per verse marks exactly its verse in its rewayah (so the two
 *    parts of every split Hafs verse are two bookmarks), and a Hafs row
 *    marks every verse holding words of its Hafs verse;
 *  - "N:M" in the mushaf search is that rewayah's verse N:M and no verse
 *    past its count; stored anchors and bookmark chips open the same verse;
 *  - its share link names exactly it, with a Hafs verse as the path;
 *  - legacy rows on Hafs keys mark and list every verse holding words of
 *    that Hafs verse (as their range, with their own text) and open the
 *    first of them;
 *  - Hafs: rows, labels, routes, searches and links are the Hafs ones.
 */
import {
  annotationAnchor,
  deriveUnitAnnotations,
  describeSavedVerse,
  noteRowKey,
  savedVerseRouteParams,
  unitForRouteAnchor,
  type AnnotationRows,
  type StoredVerseRow,
} from '../unitAnnotations';
import {
  ALL_DBS_AVAILABLE,
  allDbFiles,
  buildDbUnits,
} from '../__fixtures__/verseUnitsTestData';
import {
  anchorTarget,
  bookmarkChipText,
  verseQueryTarget,
  type ShownVerses,
} from '@/components/mushaf/mushafSearchVerses';
import {anchorShareUrl, verseShareUrl} from '@/utils/shareUtils';
import {
  formatUnitRangeLabel,
  type RewayahVerseUnits,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {SURAHS} from '@/data/surahData';

jest.mock('@/services/analytics/AnalyticsService', () => ({
  analyticsService: {trackShareCreated: jest.fn()},
}));

const MADANI_BASRI = new Set<RewayahId>([
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);

const run = ALL_DBS_AVAILABLE ? describe : describe.skip;

run('annotations, search and links on every words DB (local only)', () => {
  const files = allDbFiles();

  it('finds the words DBs', () => {
    expect(files.length).toBeGreaterThan(1);
  });

  let hafs: RewayahVerseUnits;
  beforeAll(() => {
    const hafsFile = files.find(f => f.rewayah === 'hafs');
    if (!hafsFile) throw new Error('no Hafs words DB');
    hafs = buildDbUnits(hafsFile.file, 'hafs');
  });

  for (const {file, rewayah, total} of files) {
    it(`${rewayah}: every verse is stored, opened, labelled and linked exactly`, () => {
      const units = buildDbUnits(file, rewayah);
      expect(units.units.length).toBe(total);
      const isHafs = rewayah === 'hafs';
      const shown: ShownVerses = {rewayah, units: isHafs ? null : units};
      const failures: string[] = [];
      let failureCount = 0;
      const check = (ok: boolean, msg: () => string) => {
        if (ok) return;
        failureCount += 1;
        if (failures.length < 25) failures.push(msg());
      };

      const bookmarks: Record<string, StoredVerseRow> = {};
      for (const unit of units.units) {
        const anchor = annotationAnchor(units, unit);
        const k = unit.key;
        const row = {
          verseKey: anchor.verseKey,
          surahNumber: anchor.surahNumber,
          ayahNumber: anchor.ayahNumber,
          rewayahId: rewayah,
        };
        bookmarks[anchor.verseKey] = row;

        // Storage: Hafs numbers only; Hafs rows are the Hafs keys.
        check(
          anchor.verseKey.startsWith(
            `${anchor.surahNumber}:${anchor.ayahNumber}`,
          ),
          () => `${k}: anchor ${anchor.verseKey} vs its Hafs numbers`,
        );
        if (isHafs) {
          check(anchor.verseKey === k, () => `${k}: Hafs anchor`);
        }

        // Opening and labelling the stored row.
        check(
          unitForRouteAnchor(anchor.verseKey, units) === unit,
          () => `${k}: route anchor ${anchor.verseKey}`,
        );
        const params = savedVerseRouteParams(row, 1);
        check(
          isHafs ? !('anchor' in params) : params.anchor === anchor.verseKey,
          () => `${k}: route params ${JSON.stringify(params)}`,
        );
        const description = describeSavedVerse(row, {
          units,
          status: 'ready',
        });
        if (isHafs) {
          check(description.kind === 'hafs', () => `${k}: Hafs description`);
        } else {
          check(
            description.kind === 'units' &&
              description.units.length === 1 &&
              description.units[0] === unit &&
              description.label === k &&
              description.text === units.unitText(unit),
            () => `${k}: description ${JSON.stringify(description)}`,
          );
        }

        // Mushaf search, history anchors and bookmark chips.
        const query = verseQueryTarget(unit.surah, unit.ayah, shown);
        check(
          query?.verseKey === k &&
            query.anchor === anchor.verseKey &&
            query.pageVerseKey === units.hafsAnchor(unit).hafsKey,
          () => `${k}: search ${JSON.stringify(query)}`,
        );
        check(
          anchorTarget(anchor.verseKey, shown)?.verseKey === k,
          () => `${k}: history anchor`,
        );
        // A bookmark chip of the row reads its own verse (no tag: the
        // rewayah on screen is the row's).
        const chip = bookmarkChipText('S', row, description, rewayah);
        check(
          chip ===
            (isHafs
              ? `S ${anchor.surahNumber}:${anchor.ayahNumber}`
              : `S ${k}`),
          () => `${k}: chip ${chip}`,
        );

        // Share link: the Hafs verse holding the verse's first word as the
        // path, plus the word it starts at when that is inside the Hafs
        // verse; that location is exactly this verse.
        const url = anchorShareUrl(anchor.verseKey, 'dark', rewayah);
        const at = units.hafsAnchor(unit);
        const word =
          !isHafs && at.wordPosition > 1 ? `&word=${at.wordPosition}` : '';
        check(
          url === verseShareUrl(at.surah, at.ayah, 'dark', rewayah) + word &&
            units.unitForAnchor(at.key) === unit,
          () => `${k}: link ${url}`,
        );
      }

      // Verse counts of the search follow the rewayah.
      for (let surah = 1; surah <= 114; surah++) {
        const count = units.verseCount(surah);
        if (isHafs) {
          expect(count).toBe(SURAHS[surah - 1].verses_count);
        }
        check(
          verseQueryTarget(surah, count, shown) !== null &&
            verseQueryTarget(surah, count + 1, shown) === null,
          () => `surah ${surah}: search count ${count}`,
        );
      }

      // One row per verse marks exactly its verse (split parts apart).
      const rows: AnnotationRows = {
        bookmarks,
        notes: Object.fromEntries(
          Object.values(bookmarks).map(r => [noteRowKey(r), r]),
        ),
        highlights: {},
      };
      const marks = deriveUnitAnnotations(units, rows);
      expect([...marks.bookmarkedUnitKeys]).toEqual(
        units.units.map(u => u.key),
      );
      expect([...marks.notedUnitKeys]).toEqual(units.units.map(u => u.key));
      for (const unit of units.units) {
        check(
          marks.bookmarkRowKeys(unit.key).length === 1 &&
            marks.bookmarkRowKeys(unit.key)[0] === units.hafsAnchor(unit).key,
          () => `${unit.key}: rows ${marks.bookmarkRowKeys(unit.key)}`,
        );
      }

      // Hafs rows and legacy rows keyed by a Hafs verse.
      let splits = 0;
      for (const hafsUnit of hafs.units) {
        const hafsKey = hafsUnit.key;
        const holding = units.unitsForHafsKey(hafsKey);
        if (holding.length > 1) splits += 1;
        const hafsRowMarks = deriveUnitAnnotations(units, {
          bookmarks: {[hafsKey]: {verseKey: hafsKey, rewayahId: 'hafs'}},
          notes: {},
          highlights: {},
        });
        check(
          [...hafsRowMarks.bookmarkedUnitKeys].join() ===
            holding.map(u => u.key).join(),
          () => `Hafs row ${hafsKey}: ${[...hafsRowMarks.bookmarkedUnitKeys]}`,
        );
        // A legacy row of this rewayah on the Hafs key opens a verse that
        // holds words of that Hafs verse (the first one).
        const legacy = unitForRouteAnchor(hafsKey, units);
        if (MADANI_BASRI.has(rewayah) && hafsKey === '1:1') {
          check(
            units.unitForAnchor(hafsKey) === null &&
              legacy === units.unitByRef(1, 1),
            () => 'basmala row',
          );
          const basmala = describeSavedVerse(
            {verseKey: '1:1', rewayahId: rewayah},
            {units, status: 'ready'},
          );
          check(
            basmala.kind === 'unnumbered' && basmala.hafsLabel === 'Hafs 1:1',
            () => `basmala description ${JSON.stringify(basmala)}`,
          );
          continue;
        }
        check(
          legacy === holding[0],
          () => `legacy row ${hafsKey}: ${legacy?.key} vs ${holding[0]?.key}`,
        );
        if (isHafs) continue;
        // That legacy row marks every verse holding words of its Hafs verse
        // (what it marked when it was saved), and is listed as their range
        // with their own text.
        const legacyRow = {verseKey: hafsKey, rewayahId: rewayah};
        const legacyMarks = deriveUnitAnnotations(units, {
          bookmarks: {[hafsKey]: legacyRow},
          notes: {},
          highlights: {},
        });
        check(
          [...legacyMarks.bookmarkedUnitKeys].join() ===
            holding.map(u => u.key).join(),
          () =>
            `legacy row ${hafsKey} marks ${[
              ...legacyMarks.bookmarkedUnitKeys,
            ]}`,
        );
        const listed = describeSavedVerse(legacyRow, {units, status: 'ready'});
        check(
          listed.kind === 'units' &&
            listed.label ===
              formatUnitRangeLabel(holding[0], holding[holding.length - 1]) &&
            listed.text === holding.map(u => units.unitText(u)).join(' '),
          () => `legacy row ${hafsKey} listed as ${JSON.stringify(listed)}`,
        );
      }
      if (rewayah === 'hafs' || rewayah === 'shubah') {
        expect(splits).toBe(0);
      } else {
        expect(splits).toBeGreaterThan(50);
      }

      expect({failureCount, failures}).toEqual({failureCount: 0, failures: []});
    });
  }
});
