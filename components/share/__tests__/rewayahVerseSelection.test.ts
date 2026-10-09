// @ai-generated
/**
 * Verse sheets act on the shown rewayah's OWN verses (decision 3): the
 * selection a payload names, its label and citation, the copied / shared
 * text (exactly the verses' slots with their own markers), the translation
 * pairing (Hafs-aligned: merged verses joined, a divided Hafs verse shown
 * whole with a note), the storage anchors and the share-link verse.
 *
 * Real slots of complete surahs from the Release 1 words DBs
 * (services/mushaf/__fixtures__/verseUnitsFixture.json: surahs 1, 71, 103,
 * 106, 107, 112, 114 of Hafs, Shu'bah, Warsh, al-Bazzi and al-Duri). Every
 * unit of every words DB is checked by rewayahVerseSelection.alldbs.test.ts
 * (local, BAYAAN_OVERLAY_DB_DIR). The Hafs path is compared, for every Hafs
 * verse, with the sheets' code from before the verse units.
 */
const mockDk = {
  ready: new Set<string>(['hafs', 'warsh', 'al-bazzi']),
};
jest.mock('@/services/mushaf/DigitalKhattDataService', () => ({
  digitalKhattDataService: {
    isRewayahReady: (r: string) => mockDk.ready.has(r),
    getRewayahLoadState: (r: string) =>
      mockDk.ready.has(r) ? 'ready' : 'error',
    subscribeCacheChanges: () => () => undefined,
    ensureRewayahLoaded: () => Promise.reject(new Error('no load in tests')),
    getVerseText: (key: string, rewayah?: string) => `${rewayah}:${key}`,
  },
  getRewayahDataIdentityKey: (r: string) => `${r}@test`,
}));

const mockUnitsService = {
  models: new Map<string, unknown>(),
  status: new Map<string, string>(),
};
jest.mock('@/services/mushaf/RewayahVerseUnitsService', () => ({
  rewayahVerseUnitsService: jest
    .requireActual('@/services/mushaf/__fixtures__/verseUnitsServiceStub')
    .verseUnitsServiceStub({
      peek: (r: string) => mockUnitsService.models.get(r) ?? null,
      status: (r: string) => mockUnitsService.status.get(r) ?? 'error',
    }),
}));

import {
  buildRewayahVerseUnits,
  type RewayahVerseUnits,
  type VerseUnitSlot,
} from '@/services/mushaf/RewayahVerseUnits';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';
import {SURAHS} from '@/data/surahData';
import {
  formatQuranCitation,
  formatVerseRange,
  joinVerseTexts,
} from '../rewayahVerseText';
import {
  describeStoredVerses,
  formatVerseCopyText,
  hafsReferenceLabel,
  joinTranslationParts,
  qulVerseKey,
  readUnitTexts,
  requestHafsKeys,
  resolveSelectionTexts,
  resolveVerseSelection,
  selectionCitation,
  selectionFailureMessage,
  selectionPlaybackKeys,
  selectionPreviewProps,
  selectionTranslationParts,
  selectVerses,
  sharedHafsVerseNote,
  storedVerseSelection,
  type ReadyVerseSelection,
  type VerseSelection,
  type VerseSelectionRequest,
} from '../rewayahVerseSelection';

type FixtureDb = 'hafs' | 'shouba' | 'warsh' | 'bazzi' | 'doori';
const fixture =
  require('@/services/mushaf/__fixtures__/verseUnitsFixture.json') as {
    ids: number[];
    locations: string[];
    texts: Record<FixtureDb, string[]>;
  };
const REWAYAH: Record<FixtureDb, RewayahId> = {
  hafs: 'hafs',
  shouba: 'shubah',
  warsh: 'warsh',
  bazzi: 'al-bazzi',
  doori: 'al-duri-abi-amr',
};

function build(db: FixtureDb): RewayahVerseUnits {
  const slots: VerseUnitSlot[] = fixture.ids.map((id, i) => {
    const [surah, ayah, word] = fixture.locations[i].split(':').map(Number);
    return {id, surah, ayah, word, text: fixture.texts[db][i]};
  });
  return buildRewayahVerseUnits(REWAYAH[db], slots, `${db}@test`);
}

const models = {} as Record<FixtureDb, RewayahVerseUnits>;
beforeAll(() => {
  for (const db of Object.keys(REWAYAH) as FixtureDb[]) models[db] = build(db);
});

/** A payload as a pre-units producer builds it (Hafs keys). */
function hafsRequest(
  rewayah: RewayahId,
  keys: string[],
): VerseSelectionRequest {
  const [s, a] = keys[0].split(':').map(Number);
  return {
    rewayah,
    verseKey: keys[0],
    surahNumber: s,
    ayahNumber: a,
    verseKeys: keys.length > 1 ? keys : undefined,
  };
}

/** A payload as a unit producer builds it (contract 4.1). */
function unitRequest(db: FixtureDb, unitKeys: string[]): VerseSelectionRequest {
  const model = models[db];
  const units = unitKeys.map(k => model.unitByKey(k)!);
  const anchor = model.hafsAnchor(units[0]);
  const hafsKeys = [...new Set(units.flatMap(u => [...u.hafsKeys]))];
  return {
    rewayah: model.rewayah,
    unitKeys,
    verseKey: anchor.hafsKey,
    surahNumber: anchor.surah,
    ayahNumber: anchor.ayah,
    verseKeys: hafsKeys.length > 1 ? hafsKeys : undefined,
  };
}

function ready(selection: VerseSelection): ReadyVerseSelection {
  if (selection.status !== 'ready') {
    throw new Error(`selection is ${selection.status}`);
  }
  return selection;
}

function select(db: FixtureDb, unitKeys: string[]): ReadyVerseSelection {
  return ready(selectVerses(unitRequest(db, unitKeys), models[db], 'ready'));
}

const fakeTranslation = (hafsKey: string) => `T(${hafsKey})`;
const WARSH_17_NOTE =
  'Translation of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.';

// ── Hafs: unchanged ──────────────────────────────────────────────────────

/**
 * What the sheets computed for a Hafs payload before the verse units
 * (VerseActionsSheet, ShareContent, HighlightContent, NoteContent at the
 * release base), for a payload built like every producer builds it.
 */
function previousHafsOutputs(keys: string[]) {
  const verseKey = keys[0];
  const verseKeys = keys.length > 1 ? keys : undefined;
  const [surahNumber, ayahNumber] = verseKey.split(':').map(Number);
  const isRange = !!verseKeys && verseKeys.length > 1;
  // VerseActionsSheet header / copy citation.
  let verseRefText: string;
  if (!isRange) {
    verseRefText = `${surahNumber}:${ayahNumber}`;
  } else {
    const [firstSurah, firstAyah] = verseKeys[0].split(':');
    const [lastSurah, lastAyah] = verseKeys[verseKeys.length - 1].split(':');
    verseRefText =
      firstSurah === lastSurah
        ? `${firstSurah}:${firstAyah}-${lastAyah}`
        : `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
  }
  const rowKeys = isRange ? verseKeys : [verseKey];
  return {
    verseRefText,
    citation: `Quran ${verseRefText}`,
    // Bookmark / highlight rows: one per key, Hafs surah / ayah.
    rows: rowKeys.map(vk => {
      const [s, a] = vk.split(':');
      return {key: vk, surah: parseInt(s, 10), ayah: parseInt(a, 10)};
    }),
    // ShareContent reference and link.
    shareRef: formatVerseRange(verseKeys ?? [verseKey]),
    linkVerse: {surah: surahNumber, ayah: ayahNumber},
    // Translations: one per selected key.
    translationKeys: rowKeys,
    // QUL availability: single verses only.
    qulKey: isRange ? null : `${surahNumber}:${ayahNumber}`,
    // Playback: first and last selected keys.
    playback: {firstHafsKey: rowKeys[0], lastHafsKey: rowKeys.at(-1)},
    // SkiaVersePreview props.
    preview: {verseKey, verseKeys},
  };
}

/** Every Hafs verse key, in order. */
function allHafsKeys(): string[] {
  const keys: string[] = [];
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verses_count; ayah++) {
      keys.push(`${surah.id}:${ayah}`);
    }
  }
  return keys;
}

describe('Hafs: the payload is the selection (unchanged)', () => {
  it('matches the pre-units sheets for every Hafs verse, range and cross-surah range', () => {
    const keys = allHafsKeys();
    expect(keys).toHaveLength(6236);
    const selections: string[][] = [];
    for (let i = 0; i < keys.length; i++) {
      selections.push([keys[i]]);
      if (i + 1 < keys.length) selections.push([keys[i], keys[i + 1]]);
      if (i + 2 < keys.length) {
        selections.push([keys[i], keys[i + 1], keys[i + 2]]);
      }
    }
    for (const sel of selections) {
      const previous = previousHafsOutputs(sel);
      const selection = ready(
        selectVerses(hafsRequest('hafs', sel), null, 'unavailable'),
      );
      expect(selection.label).toBe(previous.verseRefText);
      expect(selectionCitation(selection)).toBe(previous.citation);
      expect(selection.anchors).toEqual(previous.rows);
      expect(selection.label).toBe(previous.shareRef);
      expect(selection.linkVerse).toEqual(previous.linkVerse);
      expect(selection.linkLabel).toBe(
        `${previous.linkVerse.surah}:${previous.linkVerse.ayah}`,
      );
      expect(selectionTranslationParts(selection)).toEqual(
        previous.translationKeys.map(hafsKey => ({hafsKey, note: null})),
      );
      expect(
        qulVerseKey(selection, {
          surahNumber: previous.linkVerse.surah,
          ayahNumber: previous.linkVerse.ayah,
        }),
      ).toBe(previous.qulKey);
      expect(selectionPlaybackKeys(selection)).toEqual(previous.playback);
      expect(selectionPreviewProps(selection)).toEqual(previous.preview);
      expect(readUnitTexts(selection)).toBeNull();
      expect(selection.units).toBeNull();
    }
  });

  it('builds the selection from the Hafs keys without the units', () => {
    const one = ready(
      selectVerses(hafsRequest('hafs', ['1:7']), null, 'unavailable'),
    );
    expect(one).toMatchObject({
      rewayah: 'hafs',
      keys: ['1:7'],
      label: '1:7',
      surahNumber: 1,
      isRange: false,
      hafsKeys: ['1:7'],
      anchors: [{key: '1:7', surah: 1, ayah: 7}],
      linkVerse: {surah: 1, ayah: 7},
      linkLabel: '1:7',
      units: null,
      model: null,
    });
    const range = ready(
      selectVerses(
        hafsRequest('hafs', ['2:286', '3:1', '3:2']),
        null,
        'loading',
      ),
    );
    expect(range.label).toBe('2:286 - 3:2');
    expect(range.isRange).toBe(true);
    expect(range.linkLabel).toBe('2:286');
  });

  it('names no verse without a verse key, like the sheets before', () => {
    const empty: VerseSelectionRequest = {
      rewayah: 'hafs',
      verseKey: '',
      surahNumber: 0,
      ayahNumber: 0,
    };
    expect(requestHafsKeys(empty)).toEqual([]);
    expect(ready(selectVerses(empty, null, 'ready')).anchors).toEqual([]);
  });

  it('is the same through the Hafs units for every fixture verse (one code path)', () => {
    const hafs = models.hafs;
    for (const unit of hafs.units) {
      const viaKeys = ready(
        selectVerses(hafsRequest('hafs', [unit.key]), null, 'unavailable'),
      );
      const viaUnits = select('hafs', [unit.key]);
      expect(viaUnits.keys).toEqual(viaKeys.keys);
      expect(viaUnits.label).toBe(viaKeys.label);
      expect(viaUnits.anchors).toEqual(viaKeys.anchors);
      expect(viaUnits.hafsKeys).toEqual(viaKeys.hafsKeys);
      expect(viaUnits.linkVerse).toEqual(viaKeys.linkVerse);
      expect(viaUnits.linkLabel).toBe(viaKeys.linkLabel);
      expect(selectionTranslationParts(viaUnits)).toEqual(
        selectionTranslationParts(viaKeys),
      );
      expect(selectionPlaybackKeys(viaUnits)).toEqual(
        selectionPlaybackKeys(viaKeys),
      );
    }
  });
});

// ── Warsh ───────────────────────────────────────────────────────────────

describe('Warsh: the verses are its own (fixture)', () => {
  it('a split Hafs verse is two verses with their own labels and anchors', () => {
    const first = select('warsh', ['1:6']);
    expect(first.label).toBe('1:6');
    // Each part of split Hafs 1:7 names its first word.
    expect(first.anchors).toEqual([{key: '1:7:1', surah: 1, ayah: 7}]);
    expect(first.linkVerse).toEqual({surah: 1, ayah: 7});
    expect(first.linkLabel).toBe('1:6');
    expect(selectionCitation(first)).toBe('Quran 1:6 · Warsh');
    const second = select('warsh', ['1:7']);
    expect(second.label).toBe('1:7');
    expect(second.anchors).toEqual([{key: '1:7:5', surah: 1, ayah: 7}]);
    // The web reader knows Hafs verses only: the link names Hafs 1:7.
    expect(second.linkVerse).toEqual({surah: 1, ayah: 7});
    expect(second.linkLabel).toBe('1:7');
    expect(selectionCitation(second)).toBe('Quran 1:7 · Warsh');
  });

  it('copies exactly the verse: its slots, ending with its own marker', () => {
    const model = models.warsh;
    const first = select('warsh', ['1:6']);
    const [text] = readUnitTexts(first)!;
    expect(text).toBe(model.unitText(model.unitByKey('1:6')!));
    expect(text.endsWith('۝٦')).toBe(true);
    // Only its own slots: none of 1:7's words.
    const second = readUnitTexts(select('warsh', ['1:7']))![0];
    expect(second.endsWith('۝٧')).toBe(true);
    expect(text.includes(second.split(' ')[0])).toBe(false);
    // Together they are the Hafs verse 1:7's slots, broken after ۝٦.
    const wordsOfHafs17 = fixture.ids
      .map((id, i) => [fixture.locations[i], fixture.texts.warsh[i]])
      .filter(([loc, t]) => loc.startsWith('1:7:') && t)
      .map(([, t]) => t)
      .join(' ');
    expect(joinVerseTexts([text, second])).toBe(
      wordsOfHafs17.replace('۝٦ ', '۝٦\n'),
    );
    // The preview draws the unit text, never a Hafs key read.
    expect(selectionPreviewProps(first)).toEqual({verseKey: '1:6', text});
  });

  it('a divided Hafs verse shows its whole translation once, with a note', () => {
    const first = select('warsh', ['1:6']);
    const parts = selectionTranslationParts(first);
    expect(parts).toEqual([{hafsKey: '1:7', note: WARSH_17_NOTE}]);
    expect(joinTranslationParts(parts, fakeTranslation)).toBe(
      `T(1:7)\n${WARSH_17_NOTE}`,
    );
    expect(selectionTranslationParts(select('warsh', ['1:7']))).toEqual([
      {hafsKey: '1:7', note: WARSH_17_NOTE},
    ]);
    // Both verses selected: the translation is shown once, no note needed.
    const both = select('warsh', ['1:6', '1:7']);
    expect(both.label).toBe('1:6-7');
    expect(both.anchors.map(a => a.key)).toEqual(['1:7:1', '1:7:5']);
    expect(selectionTranslationParts(both)).toEqual([
      {hafsKey: '1:7', note: null},
    ]);
    expect(
      joinTranslationParts(selectionTranslationParts(both), fakeTranslation),
    ).toBe('T(1:7)');
  });

  it('a verse spanning two Hafs verses shows both translations joined', () => {
    const merged = select('warsh', ['103:1']);
    expect(merged.hafsKeys).toEqual(['103:1', '103:2']);
    expect(merged.anchors).toEqual([{key: '103:1', surah: 103, ayah: 1}]);
    expect(selectionTranslationParts(merged)).toEqual([
      {hafsKey: '103:1', note: null},
      {hafsKey: '103:2', note: null},
    ]);
    expect(
      joinTranslationParts(selectionTranslationParts(merged), fakeTranslation),
    ).toBe('T(103:1)\nT(103:2)');
    expect(selectionCitation(merged)).toBe('Quran 103:1 · Warsh');
    expect(selectionPlaybackKeys(merged)).toEqual({
      firstHafsKey: '103:1',
      lastHafsKey: '103:2',
    });
  });

  it('maps a Hafs-keyed payload to the Warsh verses holding those Hafs verses', () => {
    const split = ready(
      selectVerses(hafsRequest('warsh', ['1:7']), models.warsh, 'ready'),
    );
    expect(split.keys).toEqual(['1:6', '1:7']);
    expect(split.label).toBe('1:6-7');
    expect(split.isRange).toBe(true);
    const merged = ready(
      selectVerses(hafsRequest('warsh', ['103:2']), models.warsh, 'ready'),
    );
    expect(merged.keys).toEqual(['103:1']);
    expect(merged.label).toBe('103:1');
    expect(merged.isRange).toBe(false);
    const range = ready(
      selectVerses(
        hafsRequest('warsh', ['103:1', '103:2', '103:3']),
        models.warsh,
        'ready',
      ),
    );
    // Hafs 103:3 is Warsh 103:2 and 103:3 (inline ۝٢ inside it).
    expect(range.keys).toEqual(['103:1', '103:2', '103:3']);
    expect(range.label).toBe('103:1-3');
    expect(selectionCitation(range)).toBe('Quran 103:1-3 · Warsh');
  });

  it('the unnumbered Fatiha basmala is no verse', () => {
    const basmala = selectVerses(
      hafsRequest('warsh', ['1:1']),
      models.warsh,
      'ready',
    );
    expect(basmala).toEqual({
      status: 'invalid',
      rewayah: 'warsh',
      surahNumber: 1,
    });
    expect(selectionFailureMessage(basmala as never, 'copied')).toEqual({
      title: 'Not a numbered verse in Warsh',
      message: 'Nothing was copied.',
    });
  });

  it('a verse starting inside a Hafs verse keeps its Hafs link verse', () => {
    const v = select('warsh', ['71:24']);
    expect(v.anchors).toEqual([{key: '71:23:10', surah: 71, ayah: 23}]);
    expect(v.linkVerse).toEqual({surah: 71, ayah: 23});
    expect(v.linkLabel).toBe('71:24');
    expect(selectionTranslationParts(v)).toEqual([
      {
        hafsKey: '71:23',
        note: 'Translation of all of Hafs 71:23, which Warsh divides between verses 71:23 and 71:24.',
      },
    ]);
  });
});

describe('al-Bazzi and al-Duri (fixture)', () => {
  it('a verse made of parts of two Hafs verses notes both', () => {
    const v = select('bazzi', ['71:24']);
    expect(v.hafsKeys).toEqual(['71:23', '71:24']);
    expect(v.anchors).toEqual([{key: '71:23:10', surah: 71, ayah: 23}]);
    expect(selectionTranslationParts(v)).toEqual([
      {
        hafsKey: '71:23',
        note: 'Translation of all of Hafs 71:23, which Al-Bazzi divides between verses 71:23 and 71:24.',
      },
      {
        hafsKey: '71:24',
        note: 'Translation of all of Hafs 71:24, which Al-Bazzi divides between verses 71:24 and 71:25.',
      },
    ]);
    expect(selectionCitation(v)).toBe(formatQuranCitation('71:24', 'al-bazzi'));
    // A run covering every verse of both Hafs verses needs no note.
    const run = select('bazzi', ['71:23', '71:24', '71:25']);
    expect(selectionTranslationParts(run)).toEqual([
      {hafsKey: '71:23', note: null},
      {hafsKey: '71:24', note: null},
    ]);
    expect(run.anchors.map(a => a.key)).toEqual([
      '71:23:1',
      '71:23:10',
      '71:24:4',
    ]);
  });

  it('the Makki Fatiha basmala is verse 1', () => {
    const v = ready(
      selectVerses(hafsRequest('al-bazzi', ['1:1']), models.bazzi, 'ready'),
    );
    expect(v.keys).toEqual(['1:1']);
    expect(v.anchors).toEqual([{key: '1:1', surah: 1, ayah: 1}]);
  });

  it('al-Duri divides Hafs 71:23 and 71:24 like al-Bazzi', () => {
    const v = select('doori', ['71:25']);
    expect(v.anchors).toEqual([{key: '71:24:4', surah: 71, ayah: 24}]);
    expect(selectionCitation(v)).toBe('Quran 71:25 · Al-Duri (Abu Amr)');
  });
});

describe("Shu'bah is numbered like Hafs", () => {
  it('selects, labels and anchors every fixture verse as Hafs does', () => {
    for (const unit of models.shouba.units) {
      const viaKeys = ready(
        selectVerses(hafsRequest('shubah', [unit.key]), models.shouba, 'ready'),
      );
      const hafs = ready(
        selectVerses(hafsRequest('hafs', [unit.key]), null, 'ready'),
      );
      expect(viaKeys.keys).toEqual(hafs.keys);
      expect(viaKeys.label).toBe(hafs.label);
      expect(viaKeys.anchors).toEqual(hafs.anchors);
      expect(viaKeys.linkVerse).toEqual(hafs.linkVerse);
      expect(viaKeys.linkLabel).toBe(hafs.linkLabel);
      expect(selectionTranslationParts(viaKeys)).toEqual(
        selectionTranslationParts(hafs),
      );
    }
  });
});

// ── Stored rows (saved notes) ────────────────────────────────────────────

describe('stored rows in their own rewayah', () => {
  it('names a saved row by its anchors', () => {
    const warsh = models.warsh;
    expect(storedVerseSelection(warsh, ['1:7:5'])?.label).toBe('1:7');
    expect(storedVerseSelection(warsh, ['1:7:1'])?.label).toBe('1:6');
    // A range note: verse_keys = every anchor.
    expect(storedVerseSelection(warsh, ['1:7:1', '1:7:5'])?.label).toBe(
      '1:6-7',
    );
    // A row saved before verse units on all of Hafs 1:7: both verses.
    const legacy = storedVerseSelection(warsh, ['1:7']);
    expect(legacy?.label).toBe('1:6-7');
    expect(legacy && readUnitTexts(legacy)).toEqual([
      warsh.unitText(warsh.unitByKey('1:6')!),
      warsh.unitText(warsh.unitByKey('1:7')!),
    ]);
    // A legacy row on the second Hafs verse of a merged verse.
    expect(storedVerseSelection(warsh, ['103:2'])?.label).toBe('103:1');
    // The unnumbered basmala names no verse.
    expect(storedVerseSelection(warsh, ['1:1'])).toBeNull();
    // Not consecutive.
    expect(storedVerseSelection(warsh, ['1:2', '1:7'])).toBeNull();
  });

  it('describes a saved row, or says it cannot be named', () => {
    expect(
      describeStoredVerses(models.warsh, 'ready', ['71:23:10']),
    ).toMatchObject({status: 'ready', selection: {label: '71:24'}});
    expect(describeStoredVerses(null, 'loading', ['1:7:5'])).toEqual({
      status: 'loading',
    });
    expect(describeStoredVerses(null, 'error', ['1:7:5'])).toEqual({
      status: 'unnumbered',
      label: 'Hafs 1:7',
    });
    expect(describeStoredVerses(models.warsh, 'ready', ['1:1'])).toEqual({
      status: 'unnumbered',
      label: 'Hafs 1:1',
    });
    expect(hafsReferenceLabel(['2:3', '2:4:2', '2:5'])).toBe('Hafs 2:3-5');
    expect(hafsReferenceLabel(['nonsense'])).toBe('');
  });
});

// ── Pending and malformed ───────────────────────────────────────────────

describe('not ready, stale or malformed', () => {
  const request = hafsRequest('warsh', ['2:3']);

  it('reports the units status and never labels', () => {
    expect(selectVerses(request, null, 'loading')).toEqual({
      status: 'loading',
      rewayah: 'warsh',
      surahNumber: 2,
    });
    expect(selectVerses(request, null, 'error').status).toBe('error');
    expect(selectVerses(request, null, 'ready').status).toBe('error');
    expect(selectVerses(request, null, 'unavailable').status).toBe(
      'unavailable',
    );
    // Units of another rewayah are never used.
    expect(selectVerses(request, models.bazzi, 'ready').status).toBe('error');
  });

  it('refuses unknown or non-consecutive unit keys', () => {
    const base = unitRequest('warsh', ['1:6']);
    expect(
      selectVerses({...base, unitKeys: ['1:9']}, models.warsh, 'ready').status,
    ).toBe('invalid');
    expect(
      selectVerses({...base, unitKeys: ['1:5', '1:7']}, models.warsh, 'ready')
        .status,
    ).toBe('invalid');
    expect(
      selectVerses({...base, unitKeys: ['1:7', '1:6']}, models.warsh, 'ready')
        .status,
    ).toBe('invalid');
  });

  it('says why nothing was copied, shared or saved', () => {
    expect(
      selectionFailureMessage(
        {status: 'error', rewayah: 'warsh', surahNumber: 2},
        'shared',
      ),
    ).toEqual({
      title: "Couldn't load the Warsh text",
      message: 'Nothing was shared. Please try again.',
    });
  });
});

// ── Text formats ────────────────────────────────────────────────────────

describe('text formats', () => {
  it('copies in the existing layout', () => {
    // The pre-units VerseActionsSheet copy.
    const oldCopy = (a: string, t: string, c: string) => {
      const parts: string[] = [];
      if (a) parts.push(a);
      if (t) parts.push(t);
      parts.push(c);
      return parts.join('\n\n');
    };
    for (const [a, t] of [
      ['A', 'T'],
      ['A', ''],
      ['', 'T'],
      ['', ''],
    ]) {
      expect(formatVerseCopyText(a, t, 'Quran 1:1')).toBe(
        oldCopy(a, t, 'Quran 1:1'),
      );
    }
  });

  it('copies a Warsh verse with its own label and paired translation', () => {
    const selection = select('warsh', ['1:6']);
    const arabic = joinVerseTexts(readUnitTexts(selection)!);
    const translation = joinTranslationParts(
      selectionTranslationParts(selection),
      fakeTranslation,
    );
    expect(
      formatVerseCopyText(arabic, translation, selectionCitation(selection)),
    ).toBe(`${arabic}\n\nT(1:7)\n${WARSH_17_NOTE}\n\nQuran 1:6 · Warsh`);
  });

  it('skips a missing translation and its note', () => {
    expect(
      joinTranslationParts(
        [
          {hafsKey: '1:7', note: 'note'},
          {hafsKey: '1:8', note: null},
        ],
        k => (k === '1:7' ? '' : 'T'),
      ),
    ).toBe('T');
  });

  it('notes a divided Hafs verse for tafsir too', () => {
    const part = models.warsh.translationParts(
      models.warsh.unitByKey('1:6')!,
    )[0];
    expect(sharedHafsVerseNote(part, 'warsh', 'tafsir')).toBe(
      'Tafsir of all of Hafs 1:7, which Warsh divides between verses 1:6 and 1:7.',
    );
    expect(sharedHafsVerseNote(part, 'warsh')).toBe(WARSH_17_NOTE);
    expect(
      selectionTranslationParts(select('warsh', ['1:6']), 'tafsir')[0].note,
    ).toMatch(/^Tafsir of all of Hafs 1:7/);
  });
});

// ── QUL and playback inputs ─────────────────────────────────────────────

describe('QUL and playback inputs', () => {
  it('uses QUL only for one whole Hafs verse', () => {
    const hafsOne = selectVerses(hafsRequest('hafs', ['1:7']), null, 'ready');
    expect(qulVerseKey(hafsOne, {surahNumber: 1, ayahNumber: 7})).toBe('1:7');
    const hafsRange = selectVerses(
      hafsRequest('hafs', ['1:6', '1:7']),
      null,
      'ready',
    );
    expect(qulVerseKey(hafsRange, {surahNumber: 1, ayahNumber: 6})).toBeNull();
    expect(qulVerseKey(hafsOne, {surahNumber: 0, ayahNumber: 7})).toBeNull();
    // Warsh: an undivided verse equal to one Hafs verse.
    expect(
      qulVerseKey(select('warsh', ['1:5']), {surahNumber: 1, ayahNumber: 6}),
    ).toBe('1:6');
    expect(
      qulVerseKey(select('warsh', ['1:6']), {surahNumber: 1, ayahNumber: 7}),
    ).toBeNull();
    expect(
      qulVerseKey(select('warsh', ['103:1']), {
        surahNumber: 103,
        ayahNumber: 1,
      }),
    ).toBeNull();
    expect(
      qulVerseKey(
        {status: 'loading', rewayah: 'warsh', surahNumber: 1},
        {surahNumber: 1, ayahNumber: 7},
      ),
    ).toBeNull();
  });

  it('plays the Hafs verses holding the selection', () => {
    expect(selectionPlaybackKeys(select('warsh', ['1:7']))).toEqual({
      firstHafsKey: '1:7',
      lastHafsKey: '1:7',
    });
    expect(selectionPlaybackKeys(select('bazzi', ['71:24', '71:25']))).toEqual({
      firstHafsKey: '71:23',
      lastHafsKey: '71:24',
    });
  });
});

// ── Async (copy / share while the units load) ───────────────────────────

describe('async resolution (copy / share while units load)', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    mockUnitsService.models.clear();
    mockUnitsService.status.clear();
    // A failed side load is logged by rewayahVerseText (expected here).
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('resolves Hafs at once', async () => {
    const selection = await resolveVerseSelection(hafsRequest('hafs', ['1:7']));
    expect(ready(selection).label).toBe('1:7');
  });

  it('resolves another rewayah from its units once its words are in memory', async () => {
    mockUnitsService.models.set('warsh', models.warsh);
    const selection = ready(
      await resolveVerseSelection(unitRequest('warsh', ['1:7']), 50),
    );
    expect(selection.label).toBe('1:7');
    const texts = await resolveSelectionTexts(selection, 50);
    expect(texts).toEqual({
      status: 'ready',
      rewayah: 'warsh',
      texts: [models.warsh.unitText(models.warsh.unitByKey('1:7')!)],
    });
  });

  it('fails closed when the units are refused or the words never load', async () => {
    mockUnitsService.status.set('warsh', 'error');
    expect(
      (await resolveVerseSelection(unitRequest('warsh', ['1:7']), 50)).status,
    ).toBe('error');
    // Not in memory and the load fails.
    expect(
      (await resolveVerseSelection(hafsRequest('qalun', ['1:7']), 50)).status,
    ).toBe('error');
  });

  it('reads Hafs text through the Hafs-keyed reader', async () => {
    const selection = ready(
      await resolveVerseSelection(hafsRequest('hafs', ['1:6', '1:7'])),
    );
    expect(await resolveSelectionTexts(selection, 50)).toEqual({
      status: 'ready',
      rewayah: 'hafs',
      texts: ['hafs:1:6', 'hafs:1:7'],
    });
  });
});
