// @ai-generated
/**
 * The mushaf search overlay in the numbering of the rewayah on screen
 * (decision 3), on real slots of the Release 1 words DBs (fixture surahs):
 *  - "N:M" is verse N:M of that rewayah (Warsh has a 106:5, Hafs does not);
 *  - verse results and history say whose numbering they are;
 *  - bookmark chips read like the Bookmarks list (the saved rewayah's own
 *    verse, naming that rewayah when another one is on screen), and a
 *    stored anchor opens exactly its verse (the two parts of a split Hafs
 *    verse stay apart);
 *  - Hafs on screen: exactly the targets and labels of before.
 * Every verse of every words DB: unitAnnotations.alldbs.test.ts (local).
 */
import {
  anchorTarget,
  bookmarkChipText,
  historyEntryLabel,
  verseHistoryLabel,
  verseQueryTarget,
  verseResultTexts,
  type ShownVerses,
} from '../mushafSearchVerses';
import {
  fixtureUnits,
  must,
} from '@/services/verse-annotations/__fixtures__/verseUnitsTestData';
import {SURAHS} from '@/data/surahData';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {describeSavedVerse} from '@/services/verse-annotations/unitAnnotations';

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
    const hafsTarget = must(verseQueryTarget(1, 7, HAFS));
    expect(verseResultTexts(hafsTarget, 'Al-Fatihah')).toEqual({
      primary: 'Al-Fatihah 1:7',
      secondary: 'Verse 7',
    });
    expect(verseHistoryLabel(hafsTarget, 'Al-Fatihah 1:7')).toBe(
      'Al-Fatihah 1:7',
    );
    const warshTarget = must(verseQueryTarget(106, 5, shownReady('warsh')));
    expect(verseResultTexts(warshTarget, 'Quraysh')).toEqual({
      primary: 'Quraysh 106:5',
      secondary: 'Verse 5 · Warsh',
    });
    expect(verseHistoryLabel(warshTarget, 'Quraysh 106:5')).toBe(
      'Quraysh 106:5 · Warsh',
    );
  });
});

describe('historyEntryLabel', () => {
  const hafsEntry = {type: 'verse', label: 'Al-Fatihah 1:7', verse: 7};
  const warshEntry = {
    type: 'verse',
    label: 'Quraysh 106:5 · Warsh',
    anchor: '106:4:5',
  };
  const pageEntry = {type: 'page', label: 'Page 5'};

  it('Hafs on screen: every entry as saved', () => {
    for (const entry of [hafsEntry, warshEntry, pageEntry]) {
      expect(historyEntryLabel(entry, 'hafs')).toBe(entry.label);
    }
  });

  it('another rewayah on screen: a Hafs verse entry says it is Hafs', () => {
    expect(historyEntryLabel(hafsEntry, 'warsh')).toBe('Al-Fatihah 1:7 · Hafs');
    expect(historyEntryLabel(warshEntry, 'warsh')).toBe(warshEntry.label);
    expect(historyEntryLabel(warshEntry, 'qalun')).toBe(warshEntry.label);
    expect(historyEntryLabel(pageEntry, 'warsh')).toBe('Page 5');
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

describe('bookmarkChipText', () => {
  /** The chip text of `row` with `shown` on screen, its rewayah ready. */
  const chip = (
    row: ReturnType<typeof bm>,
    shown: RewayahId,
    status: 'ready' | 'loading' = 'ready',
  ) => {
    const saved = row.rewayahId ?? 'hafs';
    const description = describeSavedVerse(
      row,
      status === 'ready' && saved !== 'hafs'
        ? {units: fixtureUnits(saved), status}
        : {units: null, status},
    );
    return bookmarkChipText('Surah', row, description, shown);
  };

  it('Hafs bookmarks with Hafs on screen read as before', () => {
    expect(chip(bm('2:255', 'hafs'), 'hafs')).toBe('Surah 2:255');
    expect(chip(bm('2:255'), 'hafs')).toBe('Surah 2:255');
  });

  it('names the saved verse in its own rewayah numbering', () => {
    const later = {...bm('1:7', 'warsh'), verseKey: '1:7:5'};
    expect(chip(later, 'warsh')).toBe('Surah 1:7');
    expect(chip(bm('1:7', 'warsh'), 'warsh')).toBe('Surah 1:6');
    expect(chip(bm('106:4:5', 'warsh'), 'warsh')).toBe('Surah 106:5');
  });

  it('names the saved rewayah when another one is on screen', () => {
    const later = {...bm('1:7', 'warsh'), verseKey: '1:7:5'};
    expect(chip(later, 'hafs')).toBe('Surah 1:7 · Warsh');
    expect(chip(bm('2:2', 'hafs'), 'warsh')).toBe('Surah 2:2 · Hafs');
    expect(chip(bm('2:2'), 'warsh')).toBe('Surah 2:2 · Hafs');
    // al-Bazzi 71:25 starts at Hafs 71:24:4.
    expect(chip(bm('71:24:4', 'al-bazzi'), 'warsh')).toBe(
      'Surah 71:25 · Al-Bazzi',
    );
  });

  it('the unnumbered basmala keeps its Hafs reference', () => {
    expect(chip(bm('1:1', 'warsh'), 'warsh')).toBe('Surah Hafs 1:1');
  });

  it('no number while the saved rewayah verses load', () => {
    expect(chip(bm('1:7', 'warsh'), 'warsh', 'loading')).toBe('Surah');
    expect(chip(bm('1:7', 'warsh'), 'hafs', 'loading')).toBe('Surah · Warsh');
  });
});
