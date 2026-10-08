// @ai-generated
/**
 * The mushaf search overlay in the numbering of the rewayah on screen
 * (decision 3), on real slots of the Release 1 words DBs (fixture surahs):
 *  - "N:M" is verse N:M of that rewayah (Warsh has a 106:5, Hafs does not);
 *  - verse results and history say whose numbering they are;
 *  - bookmark chips are labelled with, and open, the verse of that rewayah
 *    the bookmark marks; the two parts of a split Hafs verse stay apart;
 *  - Hafs on screen: exactly the targets and labels of before.
 * Every verse of every words DB: unitAnnotations.alldbs.test.ts (local).
 */
import {
  anchorTarget,
  bookmarkChipView,
  verseHistoryLabel,
  verseQueryTarget,
  verseResultTexts,
  type ShownVerses,
} from '../mushafSearchVerses';
import {
  fixtureUnits,
  unitOf,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import {SURAHS} from '@/data/surahData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const HAFS: ShownVerses = {rewayah: 'hafs', units: null};
const shownReady = (rewayah: RewayahId): ShownVerses => ({
  rewayah,
  units: fixtureUnits(rewayah),
});
const WARSH_LOADING: ShownVerses = {rewayah: 'warsh', units: null};

const bm = (
  verseKey: string,
  rewayahId?: RewayahId | null,
): {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  rewayahId?: RewayahId | null;
} => {
  const [surah, ayah] = verseKey.split(':').map(Number);
  return {verseKey, surahNumber: surah, ayahNumber: ayah, rewayahId};
};

describe('verseQueryTarget: "N:M" in the rewayah on screen', () => {
  it('Hafs: validated against the Hafs verse counts, as before', () => {
    for (const surah of SURAHS) {
      const count = surah.verses_count;
      expect(verseQueryTarget(surah.id, count, HAFS)).toEqual({
        verseKey: `${surah.id}:${count}`,
        rewayah: 'hafs',
        pageVerseKey: `${surah.id}:${count}`,
        anchor: `${surah.id}:${count}`,
      });
      expect(verseQueryTarget(surah.id, count + 1, HAFS)).toBeNull();
    }
    expect(verseQueryTarget(0, 1, HAFS)).toBeNull();
    expect(verseQueryTarget(115, 1, HAFS)).toBeNull();
    expect(verseQueryTarget(1, 0, HAFS)).toBeNull();
  });

  it('Warsh: its own verses, opened at their anchors', () => {
    const shown = shownReady('warsh');
    // Warsh 106:5 is the later part of Hafs 106:4 (Hafs has no 106:5).
    expect(verseQueryTarget(106, 5, shown)).toEqual({
      verseKey: '106:5',
      rewayah: 'warsh',
      pageVerseKey: '106:4',
      anchor: '106:4:5',
    });
    expect(verseQueryTarget(106, 5, HAFS)).toBeNull();
    expect(verseQueryTarget(106, 6, shown)).toBeNull();
    // Warsh 1:7 vs 1:6: the two parts of Hafs 1:7.
    expect(verseQueryTarget(1, 7, shown)?.anchor).toBe('1:7:5');
    expect(verseQueryTarget(1, 6, shown)?.anchor).toBe('1:7');
    // Warsh 1:1 is Hafs 1:2 (the basmala is not a verse in Warsh).
    expect(verseQueryTarget(1, 1, shown)).toMatchObject({
      verseKey: '1:1',
      pageVerseKey: '1:2',
      anchor: '1:2',
    });
    // al-Bazzi 71:25 starts at Hafs 71:24:4.
    expect(verseQueryTarget(71, 25, shownReady('al-bazzi'))).toMatchObject({
      verseKey: '71:25',
      anchor: '71:24:4',
    });
  });

  it('names no verse while the rewayah verses are not ready', () => {
    expect(verseQueryTarget(1, 1, WARSH_LOADING)).toBeNull();
    // Units of another rewayah never answer for the one on screen.
    expect(
      verseQueryTarget(1, 1, {rewayah: 'warsh', units: fixtureUnits('hafs')}),
    ).toBeNull();
  });
});

describe('result and history texts', () => {
  it('Hafs exactly as before; another rewayah names its numbering', () => {
    const hafsTarget = verseQueryTarget(1, 7, HAFS)!;
    expect(verseResultTexts(hafsTarget, 'Al-Fatihah')).toEqual({
      primary: 'Al-Fatihah 1:7',
      secondary: 'Verse 7',
    });
    expect(verseHistoryLabel(hafsTarget, 'Al-Fatihah 1:7')).toBe(
      'Al-Fatihah 1:7',
    );
    const warshTarget = verseQueryTarget(106, 5, shownReady('warsh'))!;
    expect(verseResultTexts(warshTarget, 'Quraysh')).toEqual({
      primary: 'Quraysh 106:5',
      secondary: 'Verse 5 · Warsh',
    });
    expect(verseHistoryLabel(warshTarget, 'Quraysh 106:5')).toBe(
      'Quraysh 106:5 · Warsh',
    );
  });
});

describe('anchorTarget: a stored anchor in the rewayah on screen', () => {
  it('opens the verse holding the anchored word', () => {
    const shown = shownReady('warsh');
    expect(anchorTarget('1:7:5', shown)?.verseKey).toBe('1:7');
    expect(anchorTarget('1:7', shown)?.verseKey).toBe('1:6');
    expect(anchorTarget('106:4:5', shown)?.verseKey).toBe('106:5');
    // The unnumbered basmala: the verse after it.
    expect(anchorTarget('1:1', shown)).toMatchObject({
      verseKey: '1:1',
      anchor: '1:2',
    });
    // An al-Bazzi anchor in Warsh: the Warsh verse holding that word.
    expect(anchorTarget('71:24:4', shown)?.verseKey).toBe('71:25');
    expect(anchorTarget('bad', shown)).toBeNull();
    expect(anchorTarget('1:7:5', WARSH_LOADING)).toBeNull();
  });

  it('Hafs: the anchor Hafs verse', () => {
    expect(anchorTarget('1:7:5', HAFS)).toEqual({
      verseKey: '1:7',
      rewayah: 'hafs',
      pageVerseKey: '1:7',
      anchor: '1:7',
    });
    expect(anchorTarget('1:8', HAFS)).toBeNull();
  });
});

describe('bookmarkChipView', () => {
  it('Hafs on screen: every row as before (its Hafs reference and verse)', () => {
    for (const row of [
      bm('2:255', 'hafs'),
      bm('2:255'),
      bm('1:7', 'warsh'),
      {...bm('1:7', 'warsh'), verseKey: '1:7:5'},
    ]) {
      const key = `${row.surahNumber}:${row.ayahNumber}`;
      expect(bookmarkChipView(row, HAFS)).toEqual({
        label: key,
        target: {
          verseKey: key,
          rewayah: 'hafs',
          pageVerseKey: key,
          anchor: key,
        },
        pageVerseKey: key,
      });
    }
  });

  it('Warsh on screen: the Warsh verse the row marks', () => {
    const shown = shownReady('warsh');
    const later = bookmarkChipView(
      {...bm('1:7', 'warsh'), verseKey: '1:7:5'},
      shown,
    );
    expect(later.label).toBe('1:7');
    expect(later.target?.verseKey).toBe('1:7');
    const first = bookmarkChipView(bm('1:7', 'warsh'), shown);
    expect(first.label).toBe('1:6');
    expect(first.target?.verseKey).toBe('1:6');
    // A Hafs bookmark on split Hafs 1:7 marks both Warsh verses.
    const hafsRow = bookmarkChipView(bm('1:7', 'hafs'), shown);
    expect(hafsRow.label).toBe('1:6-7');
    expect(hafsRow.target?.verseKey).toBe('1:6');
    // Hafs 103:2 is inside Warsh 103:1.
    expect(bookmarkChipView(bm('103:2', 'hafs'), shown).label).toBe('103:1');
    expect(bookmarkChipView(bm('103:2', null), shown).label).toBe('103:1');
    expect(unitOf(fixtureUnits('warsh'), '103:1').hafsKeys).toEqual([
      '103:1',
      '103:2',
    ]);
  });

  it('the unnumbered basmala keeps its Hafs reference and opens verse 1', () => {
    const view = bookmarkChipView(bm('1:1', 'hafs'), shownReady('warsh'));
    expect(view.label).toBe('Hafs 1:1');
    expect(view.target).toMatchObject({verseKey: '1:1', anchor: '1:2'});
    expect(view.pageVerseKey).toBe('1:1');
  });

  it('no number while the verses are not ready: opens the page', () => {
    expect(bookmarkChipView(bm('1:7', 'warsh'), WARSH_LOADING)).toEqual({
      label: null,
      target: null,
      pageVerseKey: '1:7',
    });
  });
});
