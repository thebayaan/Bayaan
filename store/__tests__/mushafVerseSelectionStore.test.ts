// @ai-generated
/**
 * The mushaf selection holds verse units of the shown rewayah (decision 3):
 * keys in that rewayah's own numbering, recorded with the rewayah and each
 * unit's Hafs storage anchor; Hafs-keyed callers (QCF, routes, navigation)
 * keep selecting Hafs verses exactly as before. The verse-actions payload
 * carries the units (`rewayah` + `unitKeys`) with Hafs fields that keep
 * their Hafs meaning, and is the previous payload for Hafs.
 */
import {
  useMushafVerseSelectionStore,
  verseActionsPayloadForUnits,
  type SelectedVerseUnit,
} from '../mushafVerseSelectionStore';

const store = () => useMushafVerseSelectionStore.getState();

// Real Warsh units (verseUnitsFixture.json): Warsh 1:6 and 1:7 split Hafs
// 1:7 (the second part is anchored at Hafs word 5); Warsh 103:1 holds Hafs
// 103:1 and 103:2.
const W_1_6: SelectedVerseUnit = {key: '1:6', anchor: '1:7', hafsKeys: ['1:7']};
const W_1_7: SelectedVerseUnit = {
  key: '1:7',
  anchor: '1:7:5',
  hafsKeys: ['1:7'],
};
const W_103_1: SelectedVerseUnit = {
  key: '103:1',
  anchor: '103:1',
  hafsKeys: ['103:1', '103:2'],
};

afterEach(() => store().clearSelection());

describe('selection state', () => {
  it('starts empty', () => {
    expect(store()).toMatchObject({
      selectedVerseKey: null,
      selectedVerseKeys: [],
      selectedPageNumber: null,
      selectedRewayah: null,
      selectedUnits: [],
    });
  });

  it('selectUnits records the units, their rewayah and anchors', () => {
    store().selectUnits('warsh', [W_1_6, W_1_7], 1);
    expect(store()).toMatchObject({
      selectedVerseKey: '1:6',
      selectedVerseKeys: ['1:6', '1:7'],
      selectedPageNumber: 1,
      selectedRewayah: 'warsh',
      selectedUnits: [W_1_6, W_1_7],
    });
    store().selectUnits('warsh', [], 1);
    expect(store().selectedRewayah).toBeNull();
    expect(store().selectedVerseKeys).toEqual([]);
  });

  it('selectVerse / selectVerseRange select Hafs verses as before', () => {
    store().selectVerse('2:255', 42);
    expect(store()).toMatchObject({
      selectedVerseKey: '2:255',
      selectedVerseKeys: ['2:255'],
      selectedPageNumber: 42,
      selectedRewayah: 'hafs',
      selectedUnits: [{key: '2:255', anchor: '2:255', hafsKeys: ['2:255']}],
    });
    store().selectVerseRange(['2:255', '2:256'], 42);
    expect(store()).toMatchObject({
      selectedVerseKey: '2:255',
      selectedVerseKeys: ['2:255', '2:256'],
      selectedPageNumber: 42,
      selectedRewayah: 'hafs',
    });
    expect(store().selectedUnits.map(u => u.anchor)).toEqual([
      '2:255',
      '2:256',
    ]);
  });

  it('clearSelection clears everything', () => {
    store().selectUnits('warsh', [W_103_1], 601);
    store().clearSelection();
    expect(store()).toMatchObject({
      selectedVerseKey: null,
      selectedVerseKeys: [],
      selectedPageNumber: null,
      selectedRewayah: null,
      selectedUnits: [],
    });
  });

  it('keepSelectionFor drops units of another rewayah only (CONTRACT 4.7)', () => {
    store().selectUnits('warsh', [W_1_7], 1);
    store().keepSelectionFor('warsh');
    expect(store().selectedVerseKeys).toEqual(['1:7']);
    // Warsh 1:7 is not Qalun 1:7: the selection goes.
    store().keepSelectionFor('qalun');
    expect(store().selectedVerseKeys).toEqual([]);
    expect(store().selectedRewayah).toBeNull();
    // A Hafs selection names the same verses in every rewayah: kept.
    store().selectVerse('1:7', 1);
    store().keepSelectionFor('warsh');
    expect(store().selectedVerseKeys).toEqual(['1:7']);
    expect(store().selectedRewayah).toBe('hafs');
    store().clearSelection();
    store().keepSelectionFor('warsh');
    expect(store().selectedRewayah).toBeNull();
  });
});

describe('verseActionsPayloadForUnits (CONTRACT 4.1)', () => {
  it('Hafs: exactly the previous payload, plus rewayah and unitKeys', () => {
    const hafs = (keys: string[]) =>
      keys.map(key => ({key, anchor: key, hafsKeys: [key]}));
    expect(verseActionsPayloadForUnits('hafs', hafs(['2:255']))).toEqual({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      verseKeys: undefined,
      source: 'mushaf',
      rewayah: 'hafs',
      unitKeys: ['2:255'],
    });
    expect(
      verseActionsPayloadForUnits('hafs', hafs(['2:255', '2:256', '2:257'])),
    ).toEqual({
      verseKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      verseKeys: ['2:255', '2:256', '2:257'],
      source: 'mushaf',
      rewayah: 'hafs',
      unitKeys: ['2:255', '2:256', '2:257'],
    });
  });

  it('the second part of a split Hafs verse: Hafs fields name its Hafs verse', () => {
    expect(verseActionsPayloadForUnits('warsh', [W_1_7])).toEqual({
      verseKey: '1:7',
      surahNumber: 1,
      ayahNumber: 7,
      verseKeys: undefined,
      source: 'mushaf',
      rewayah: 'warsh',
      unitKeys: ['1:7'],
    });
    // Both parts: one Hafs verse, two units.
    expect(verseActionsPayloadForUnits('warsh', [W_1_6, W_1_7])).toMatchObject({
      verseKey: '1:7',
      verseKeys: undefined,
      unitKeys: ['1:6', '1:7'],
    });
  });

  it('a merged verse lists every Hafs verse it holds', () => {
    expect(verseActionsPayloadForUnits('warsh', [W_103_1])).toEqual({
      verseKey: '103:1',
      surahNumber: 103,
      ayahNumber: 1,
      verseKeys: ['103:1', '103:2'],
      source: 'mushaf',
      rewayah: 'warsh',
      unitKeys: ['103:1'],
    });
  });

  it('no units (or a malformed anchor): no payload', () => {
    expect(verseActionsPayloadForUnits('warsh', [])).toBeNull();
    expect(
      verseActionsPayloadForUnits('warsh', [
        {key: '1:6', anchor: 'nonsense', hafsKeys: ['1:7']},
      ]),
    ).toBeNull();
  });
});
