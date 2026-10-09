// @ai-generated
/**
 * The verse actions sheet's Hafs-aligned screens (translation and tafsir
 * pagers, word by word, theme, similar verses) for a rewayah verse in its own
 * numbering (decision 3), and unchanged for Hafs. Real slots of complete
 * surahs (services/mushaf/__fixtures__/verseUnitsFixture.json).
 */
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {},
  getRewayahDataIdentityKey: () => null,
}));
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({peek: () => null, status: () => 'error'}),
}));
jest.mock('@/services/tafseer/TafseerDbService', () => ({}));

import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {
  distinctTafseerResults,
  hafsPagerPage,
  joinPartTexts,
  rewayahThemePassage,
  similarVerseRef,
  tafseerBadge,
  unitPagerPage,
  wbwParts,
} from '../verseUnitScreens';

type FixtureDb = 'hafs' | 'warsh' | 'bazzi';
const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<FixtureDb, string[]>;
  };
const REWAYAH: Record<FixtureDb, RewayahId> = {
  hafs: 'hafs',
  warsh: 'warsh',
  bazzi: 'al-bazzi',
};

function build(db: FixtureDb): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts[db][i]};
  });
  return buildRewayahVerseUnits(REWAYAH[db], slots, `${db}@test`);
}

let hafs: RewayahVerseUnits;
let warsh: RewayahVerseUnits;
let bazzi: RewayahVerseUnits;
beforeAll(() => {
  hafs = build('hafs');
  warsh = build('warsh');
  bazzi = build('bazzi');
});

const unit = (model: RewayahVerseUnits, key: string) => {
  const found = model.unitByKey(key);
  if (!found) throw new Error(`no ${model.rewayah} ${key}`);
  return found;
};

describe('translation and tafsir pagers', () => {
  it('a Hafs page is the page from before the verse units', () => {
    expect(hafsPagerPage('2:255')).toEqual({
      key: '2:255',
      label: '2:255',
      hafsKeys: ['2:255'],
      notes: [],
      previewVerseKey: '2:255',
      hafsReferences: false,
    });
  });

  it('a Hafs unit page would read the same Hafs verse and text', () => {
    for (const u of hafs.units) {
      const page = unitPagerPage(hafs, u, 'translation');
      expect(page.label).toBe(u.key);
      expect(page.hafsKeys).toEqual([u.key]);
      expect(page.notes).toEqual([]);
      expect(page.previewText).toBe(hafs.unitText(u));
    }
  });

  it('pages a Warsh verse in its own numbering, with its Hafs parts', () => {
    const v16 = unitPagerPage(warsh, unit(warsh, '1:6'), 'translation');
    expect(v16).toMatchObject({
      key: 'warsh:1:6',
      label: '1:6',
      hafsKeys: ['1:7'],
      notes: [
        'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.',
      ],
      previewVerseKey: '1:6',
      hafsReferences: true,
    });
    expect(v16.previewText).toBe(warsh.unitText(unit(warsh, '1:6')));
    expect(v16.previewText?.endsWith('۝٦')).toBe(true);

    const merged = unitPagerPage(warsh, unit(warsh, '103:1'), 'tafsir');
    expect(merged.hafsKeys).toEqual(['103:1', '103:2']);
    expect(merged.notes).toEqual([]);

    const tafsir = unitPagerPage(warsh, unit(warsh, '1:7'), 'tafsir');
    expect(tafsir.notes).toEqual([
      'Tafsir of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.',
    ]);
  });

  it('a verse made of parts of two Hafs verses notes both', () => {
    const page = unitPagerPage(bazzi, unit(bazzi, '71:24'), 'translation');
    expect(page.hafsKeys).toEqual(['71:23', '71:24']);
    expect(page.notes).toHaveLength(2);
  });

  it('joins the translations of several Hafs verses, one per line', () => {
    expect(joinPartTexts(['A', null, '', undefined, 'B'])).toBe('A\nB');
    expect(joinPartTexts(['only'])).toBe('only');
    expect(joinPartTexts([''])).toBe('');
  });

  it('labels tafsir passages as Hafs only in another rewayah', () => {
    const passage = (fromAyah: number, toAyah: number, surahNumber = 2) => ({
      surahNumber,
      fromAyah,
      toAyah,
    });
    const hafsPage = hafsPagerPage('2:3');
    // Hafs: exactly the badge from before.
    expect(tafseerBadge(passage(1, 5), hafsPage, 1)).toBe('VERSES 2:1 – 2:5');
    expect(tafseerBadge(passage(3, 3), hafsPage, 1)).toBeNull();
    // Another rewayah: Hafs references say so.
    const page = {label: '2:1', hafsReferences: true};
    expect(tafseerBadge(passage(1, 5), page, 1)).toBe('HAFS VERSES 2:1 – 2:5');
    expect(tafseerBadge(passage(1, 1), page, 2)).toBe('HAFS 2:1');
    expect(tafseerBadge(passage(2, 2), page, 1)).toBe('HAFS 2:2');
    expect(tafseerBadge(passage(1, 1), page, 1)).toBeNull();
  });

  it('shows a grouped tafsir passage once', () => {
    const a = {surahNumber: 2, fromAyah: 1, toAyah: 5, text: 'A'};
    const b = {surahNumber: 2, fromAyah: 6, toAyah: 6, text: 'B'};
    expect(distinctTafseerResults([a, {...a}, null, b] as never)).toEqual([
      a,
      b,
    ]);
  });
});

describe('word by word', () => {
  it('Hafs: the verse itself, no caption', () => {
    expect(wbwParts('2:255')).toEqual([{verseKey: '2:255', caption: null}]);
  });

  it('a rewayah verse shows each Hafs verse it holds, captioned', () => {
    expect(wbwParts('1:7', {model: warsh, unit: unit(warsh, '1:6')})).toEqual([
      {verseKey: '1:7', caption: 'Hafs 1:7'},
    ]);
    expect(
      wbwParts('103:1', {model: warsh, unit: unit(warsh, '103:1')}),
    ).toEqual([
      {verseKey: '103:1', caption: 'Hafs 103:1'},
      {verseKey: '103:2', caption: 'Hafs 103:2'},
    ]);
    // One whole Hafs verse under another number (Warsh 1:2 = Hafs 1:3).
    expect(wbwParts('1:2', {model: warsh, unit: unit(warsh, '1:2')})).toEqual([
      {verseKey: '1:3', caption: 'Hafs 1:3'},
    ]);
    // The same verse under the same number: no caption.
    expect(
      wbwParts('112:1', {model: warsh, unit: unit(warsh, '112:1')}),
    ).toEqual([{verseKey: '112:1', caption: null}]);
  });
});

describe('themes', () => {
  it("tells a theme's Hafs passage in the rewayah's numbering", () => {
    // Hafs 1:1-7 in Warsh: the basmala is no verse; Warsh 1:1-7.
    expect(rewayahThemePassage(warsh, 1, 1, 7)).toEqual({
      range: '1:1 – 1:7',
      count: 7,
    });
    // Hafs 103:1-2 is the one Warsh verse 103:1.
    expect(rewayahThemePassage(warsh, 103, 1, 2)).toEqual({
      range: '103:1 – 103:1',
      count: 1,
    });
    // Only the unnumbered basmala: no verse.
    expect(rewayahThemePassage(warsh, 1, 1, 1)).toBeNull();
  });
});

describe('similar verses', () => {
  it('prefixes Hafs references in another rewayah only', () => {
    expect(similarVerseRef('2:255', false)).toBe('2:255');
    expect(similarVerseRef('2:255', true)).toBe('Hafs 2:255');
  });
});
