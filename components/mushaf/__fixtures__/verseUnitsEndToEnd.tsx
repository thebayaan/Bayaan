// @ai-generated
/**
 * Test-only harness of the verse-units end-to-end tests (decision 3 of
 * Release 1): verseUnitsEndToEnd.test.tsx (real slots of seven complete
 * surahs of five words DBs; always runs) and verseUnitsEndToEnd.alldbs.test.tsx
 * (every verse of every words DB; local only). The test files mock the
 * native edges (DigitalKhattDataService as the fixture stand-in, the verse
 * units service, the sheet manager, haptics, the annotations database) and
 * call runEndToEnd() for each words DB.
 *
 * The chain is the app's own code from a word on a mushaf page to what the
 * reader sees, copies, plays and stores:
 *  1. long-press on every word (useVerseUnitDragSelect, the hook both page
 *     renderers use) -> mushaf selection store -> verse-actions payload; and
 *     the iOS drag over every page;
 *  2. the selection band the page paints from the store
 *     (computeUnitPageHighlightLayers, composed as SkiaPage composes it);
 *  3. the sheet's selection of the payload (selectVerses) -> copied text,
 *     translation parts and citation (the verse actions sheet's Copy);
 *  4. a reciter whose timings are numbered by the rewayah: where Play from
 *     here starts (mushaf player and main player), what Repeat loops, and
 *     the follow-along band it paints;
 *  5. the storage anchor: the row a bookmark writes through the annotations
 *     store, the verse that row marks, the route a saved row opens and the
 *     verse it selects there, and the share link.
 * Expectations come from an independent walk of the words rows (walkOracle:
 * verse N of a surah runs up to the slot whose last token is the marker N;
 * the Madani / Basri Fatiha basmala is no verse), never from the units
 * module.
 *
 * Hafs differential: the Hafs words run the same chain and must give exactly
 * the base (pre-verse-unit) results on every page: page order, payloads,
 * painted selection and playback layers, copied text, citations, storage
 * keys, routes and links (baseHafsVersePipeline.ts is the base code).
 *
 * Not imported by app code.
 */
import React, {act} from 'react';
import TestRenderer from 'react-test-renderer';
import {
  digitalKhattDataService,
  type DKLine,
} from '@/services/mushaf/DigitalKhattDataService';
import type {FakeDKService} from '@/services/mushaf/__fixtures__/rewayahOverlayFixture';
import {
  mushafVerseMapService,
  selectionForAnchor,
} from '@/services/mushaf/MushafVerseMapService';
import {getLineWordSpans} from '@/services/mushaf/lineWordSpans';
import type {
  RewayahVerseUnits,
  VerseUnit,
} from '@/services/mushaf/RewayahVerseUnits';
import {rewayahVerseUnitsService} from '@/services/mushaf/RewayahVerseUnitsService';
import {rewayahVerseMapService} from '@/services/mushaf/RewayahVerseMapService';
import {
  useVerseUnitDragSelect,
  type LineCharHit,
  type VerseUnitDragHandlers,
} from '@/components/mushaf/skia/verseUnitDragSelect';
import {
  computeUnitPageHighlightLayers,
  NO_PLAYBACK_BAND,
  type LineHighlight,
  type PageVerseLayerSources,
  type PlaybackBand,
} from '@/components/mushaf/skia/verseHighlightLayers';
import {useMushafVerseSelectionStore} from '@/store/mushafVerseSelectionStore';
import {
  formatVerseCopyText,
  joinTranslationParts,
  readUnitTexts,
  selectionTranslationParts,
  selectVerses,
  type ReadyVerseSelection,
} from '@/components/share/rewayahVerseSelection';
import {
  formatQuranCitation,
  formatVerseRange,
  joinVerseTexts,
} from '@/components/share/rewayahVerseText';
import {
  createTimingNumbering,
  registerTimingNumbering,
  toAudioUnitTarget,
  type AudioUnitTarget,
  type TimingNumbering,
} from '@/utils/timestampNumbering';
import {resolvePlayFromHere, useTimestampStore} from '@/store/timestampStore';
import {
  annotationAnchor,
  deriveUnitAnnotations,
  noteRowKey,
  savedVerseRouteParams,
} from '@/services/verse-annotations/unitAnnotations';
import {
  selectUnitAnnotations,
  useVerseAnnotationsStore,
} from '@/store/verseAnnotationsStore';
import {anchorShareUrl, verseShareUrl} from '@/utils/shareUtils';
import {
  baseComputePageHighlightLayers,
  baseOrderedVerseKeysForPage,
  basePayloadForKeys,
  baseVerseSegmentsForPage,
} from '@/services/mushaf/__fixtures__/baseHafsVersePipeline';
import type {AyahTimestamp} from '@/types/timestamps';
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

// ── The words of one DB ─────────────────────────────────────────────────────

export interface EndToEndData {
  rewayah: RewayahId;
  /** Words rows in id order: [id, 'S:A:W' (Hafs location), text]. */
  words: readonly (readonly [number, string, string])[];
  /** Layout lines of every page holding the words. */
  lines: readonly DKLine[];
  /** Those pages in reading order. */
  pages: readonly number[];
}

/** What the sheet's copy and the citation name each rewayah (product copy). */
const CITED_AS: Partial<Record<RewayahId, string>> = {
  shubah: "Shu'bah",
  'al-bazzi': 'Al-Bazzi',
  qunbul: 'Qunbul',
  warsh: 'Warsh',
  qalun: 'Qalun',
  'al-duri-abi-amr': 'Al-Duri (Abu Amr)',
  'al-susi': 'Al-Susi',
};

const MADANI_BASRI = new Set<RewayahId>([
  'warsh',
  'qalun',
  'al-duri-abi-amr',
  'al-susi',
]);

// ── Independent walk of the slots ───────────────────────────────────────────

export interface OracleUnit {
  readonly key: string;
  readonly surah: number;
  readonly ayah: number;
  readonly firstId: number;
  readonly lastId: number;
  /**
   * Its storage anchor, the Hafs location of its first slot: 'S:A' when it
   * starts at word 1 of a Hafs verse no other verse holds words of, else
   * 'S:A:W' (the first part of a split Hafs verse is 'S:A:1').
   */
  readonly anchor: string;
  readonly anchorSurah: number;
  readonly anchorAyah: number;
  /** Hafs word position of its first slot. */
  readonly anchorWord: number;
  /** Hafs verses holding its words, reading order. */
  readonly hafsKeys: readonly string[];
  /** Its non-blank slots joined by single spaces (ends with its marker). */
  readonly text: string;
}

export interface Oracle {
  readonly units: readonly OracleUnit[];
  readonly byKey: ReadonlyMap<string, OracleUnit>;
  /** Unit of every slot; null for the unnumbered Fatiha basmala. */
  readonly unitOfSlot: ReadonlyMap<number, OracleUnit | null>;
  /** Hafs verse -> keys of the verses holding its words, reading order. */
  readonly holders: ReadonlyMap<string, readonly string[]>;
}

const MARKER = /^۝([٠-٩]+|[۰-۹]+)$/;

function markerNumber(token: string): number | null {
  const m = MARKER.exec(token);
  if (!m) return null;
  let n = 0;
  for (const ch of m[1]) {
    const code = ch.charCodeAt(0);
    n = n * 10 + (code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }
  return n;
}

/**
 * The rewayah's verses read straight from the rows (contract C1): verse N of
 * a surah runs up to the slot whose last token is the marker N; a slot with
 * text other than its marker holds words of its Hafs verse; the Madani /
 * Basri Fatiha basmala (the Hafs 1:1 slots) belongs to no verse.
 */
export function walkOracle(
  rewayah: RewayahId,
  words: EndToEndData['words'],
): Oracle {
  // Anchors are set once every verse is known (they depend on the others).
  const units: {-readonly [K in keyof OracleUnit]: OracleUnit[K]}[] = [];
  const unitOfSlot = new Map<number, OracleUnit | null>();
  const holders = new Map<string, string[]>();
  let surah = 0;
  let count = 0;
  let open: {
    firstId: number;
    anchor: [number, number, number];
    slots: number[];
    texts: string[];
    hafsKeys: string[];
  } | null = null;
  for (const [id, location, text] of words) {
    const [s, a, w] = location.split(':').map(Number);
    if (s !== surah) {
      if (open) throw new Error(`surah ${surah} ends inside a verse`);
      surah = s;
      count = 0;
    }
    if (MADANI_BASRI.has(rewayah) && s === 1 && a === 1) {
      unitOfSlot.set(id, null);
      continue;
    }
    if (!open) {
      open = {
        firstId: id,
        anchor: [s, a, w],
        slots: [],
        texts: [],
        hafsKeys: [],
      };
    }
    open.slots.push(id);
    if (!text) continue;
    open.texts.push(text);
    const tokens = text.split(' ');
    const marker = markerNumber(tokens[tokens.length - 1]);
    if (marker === null || tokens.length > 1) {
      const hafsKey = `${s}:${a}`;
      if (open.hafsKeys[open.hafsKeys.length - 1] !== hafsKey) {
        open.hafsKeys.push(hafsKey);
      }
    }
    if (marker === null) continue;
    count += 1;
    if (marker !== count) throw new Error(`${location}: marker ${marker}`);
    const [as, aa, aw] = open.anchor;
    const unit = {
      key: `${s}:${marker}`,
      surah: s,
      ayah: marker,
      firstId: open.firstId,
      lastId: id,
      anchor: '',
      anchorSurah: as,
      anchorAyah: aa,
      anchorWord: aw,
      hafsKeys: open.hafsKeys,
      text: open.texts.join(' '),
    };
    units.push(unit);
    for (const slot of open.slots) unitOfSlot.set(slot, unit);
    for (const hafsKey of unit.hafsKeys) {
      const list = holders.get(hafsKey);
      if (list) list.push(unit.key);
      else holders.set(hafsKey, [unit.key]);
    }
    open = null;
  }
  if (open) throw new Error(`surah ${surah} ends inside a verse`);
  for (const unit of units) {
    const hafsKey = `${unit.anchorSurah}:${unit.anchorAyah}`;
    const alone =
      unit.anchorWord === 1 &&
      unit.hafsKeys[0] === hafsKey &&
      holders.get(hafsKey)?.length === 1;
    unit.anchor = alone ? hafsKey : `${hafsKey}:${unit.anchorWord}`;
  }
  return {
    units,
    byKey: new Map(units.map(u => [u.key, u])),
    unitOfSlot,
    holders,
  };
}

// ── Report ──────────────────────────────────────────────────────────────────

/** Failures of one DB: the first ones in full, and how many there were. */
export interface EndToEndReport {
  failures: string[];
  count: number;
  /** How many of each check ran (so a silently empty run fails). */
  checked: Record<string, number>;
}

function reporter() {
  const report: EndToEndReport = {failures: [], count: 0, checked: {}};
  return {
    report,
    fail(msg: string) {
      report.count += 1;
      if (report.failures.length < 25) report.failures.push(msg);
    },
    tick(name: string) {
      report.checked[name] = (report.checked[name] ?? 0) + 1;
    },
  };
}

// ── The page renderers' gesture hook ────────────────────────────────────────

interface HarnessProps {
  page: number;
  charAt: (x: number, y: number) => LineCharHit | null;
  onHandlers: (handlers: VerseUnitDragHandlers) => void;
}

function GestureHarness({page, charAt, onHandlers}: HarnessProps) {
  onHandlers(useVerseUnitDragSelect(page, charAt));
  return null;
}

/** What the sheet manager was last asked to open (the test files' mock). */
export interface SheetRequest {
  name: string;
  payload: unknown;
}

// ── Painting, as SkiaPage composes it ───────────────────────────────────────

const COLORS = {bookmark: 'B', play: 'P', select: 'S'};
const NO_SOURCES: PageVerseLayerSources = {
  bookmarkedVerseKeys: new Set(),
  persistentHighlights: {},
  playback: NO_PLAYBACK_BAND,
  selection: null,
};

function paint(
  page: number,
  sources: Partial<PageVerseLayerSources>,
): Map<number, LineHighlight[]> {
  return (
    computeUnitPageHighlightLayers({
      pageNumber: page,
      shown: mushafVerseMapService.getShownVerseUnits(),
      segments: mushafVerseMapService,
      diffHighlights: new Map(),
      themes: null,
      sources: {...NO_SOURCES, ...sources},
      bookmarkColor: COLORS.bookmark,
      highlightColors: {},
      playbackColor: COLORS.play,
      selectionColor: COLORS.select,
    }) ?? new Map()
  );
}

/** Lines with highlights only, comparable as a string. */
function layersId(layers: ReadonlyMap<number, readonly LineHighlight[]>) {
  return JSON.stringify(
    [...layers].filter(([, list]) => list.length > 0).sort(([a], [b]) => a - b),
  );
}

/** The base (pre-verse-unit) painting of Hafs verse keys on a page. */
function basePaint(
  page: number,
  layer: 'selection' | 'playback',
  keys: readonly string[],
): Map<number, LineHighlight[]> {
  return (
    baseComputePageHighlightLayers({
      getVerseSegments: vk =>
        baseVerseSegmentsForPage(digitalKhattDataService, page, vk),
      diffHighlights: new Map(),
      themes: null,
      bookmarkedVerseKeys: new Set(),
      bookmarkColor: COLORS.bookmark,
      persistentHighlights: {},
      highlightColors: {},
      playbackVerseKeys: layer === 'playback' ? keys : [],
      playbackColor: COLORS.play,
      selectedVerseKeys: layer === 'selection' ? keys : null,
      selectionColor: COLORS.select,
    }) ?? new Map()
  );
}

// ── The run ─────────────────────────────────────────────────────────────────

/** One verse's words on one line of a page: [start, end] in the line text. */
interface LineRun {
  lineIndex: number;
  start: number;
  end: number;
}

/** A word on a page: where a long-press lands, and its verse. */
interface WordHit {
  lineIndex: number;
  start: number;
  end: number;
  unit: OracleUnit | null;
}

export interface EndToEndDeps {
  /** The sheet manager mock's last request (reset before each gesture). */
  sheet: {last: SheetRequest | null};
  /**
   * Before the run: make the verse units of `data` the ones the app reads
   * (the test file's units service mock) once the words are loaded.
   */
  useUnitsOf?: (data: EndToEndData) => void;
  /** The verse units the app reads for the rewayah (null for none). */
  unitsOf: (rewayah: RewayahId) => RewayahVerseUnits | null;
  /** The annotations database mock's last write. */
  database: {
    lastAddBookmark: unknown[] | null;
    lastRemoveBookmark: unknown[] | null;
  };
}

/**
 * Runs the whole chain on one words DB. Returns the report; the caller
 * expects no failures and every check to have run.
 */
export async function runEndToEnd(
  data: EndToEndData,
  deps: EndToEndDeps,
): Promise<EndToEndReport> {
  const {fail, tick, report} = reporter();
  const {rewayah} = data;
  const isHafs = rewayah === 'hafs';
  const dk = digitalKhattDataService as unknown as FakeDKService;

  // Load the words (the mushaf on screen is this rewayah).
  mushafVerseMapService.clear();
  dk.loadData({
    rewayah,
    words: data.words.map(([id, location, text]) => [id, location, text]),
    lines: [...data.lines],
  });
  deps.useUnitsOf?.(data);
  useMushafVerseSelectionStore.getState().clearSelection();

  const oracle = walkOracle(rewayah, data.words);
  // Hafs on screen never builds verse units (its verses are the Hafs
  // verses): its chain runs the Hafs code paths, as the app does.
  const model = isHafs ? null : deps.unitsOf(rewayah);
  if (!isHafs && !model) {
    fail('no verse units for the rewayah on screen');
    return report;
  }
  const shown = mushafVerseMapService.getShownVerseUnits();
  if (!shown || shown.rewayah !== rewayah) {
    fail(`the mushaf shows no ${rewayah} verses`);
    return report;
  }

  // ── 1-2. Long-press every word; drag over every page; selection band ─────
  const hit: {current: LineCharHit | null} = {current: null};
  const charAt = () => hit.current;
  const gesture: {handlers: VerseUnitDragHandlers | null} = {handlers: null};
  const onHandlers = (h: VerseUnitDragHandlers) => {
    gesture.handlers = h;
  };
  const view: {renderer: TestRenderer.ReactTestRenderer | null} = {
    renderer: null,
  };
  await act(async () => {
    view.renderer = TestRenderer.create(
      <GestureHarness
        page={data.pages[0]}
        charAt={charAt}
        onHandlers={onHandlers}
      />,
    );
  });

  /** Payload of the first long-press on each verse (for the sheet). */
  const payloadOf = new Map<string, unknown>();
  /** Pages holding each verse's words, and its runs there. */
  const runsOf = new Map<string, Map<number, LineRun[]>>();
  /** Line texts per page (for the drawn text). */
  const lineTexts = new Map<number, string[]>();
  const select = useMushafVerseSelectionStore;

  // What the sheet manager was last asked (read through a function: the
  // gestures write it).
  const lastSheet = (): SheetRequest | null => deps.sheet.last;
  const press = (target: LineCharHit) => {
    hit.current = target;
    deps.sheet.last = null;
    select.getState().clearSelection();
    gesture.handlers!.onDragStart(0, 0);
    gesture.handlers!.onDragEnd();
  };

  for (const page of data.pages) {
    await act(async () => {
      view.renderer!.update(
        <GestureHarness page={page} charAt={charAt} onHandlers={onHandlers} />,
      );
    });
    const lines = dk.getPageLines(page);
    lineTexts.set(
      page,
      lines.map(line => dk.getLineText(line)),
    );
    const words: WordHit[] = [];
    const pageOrder: string[] = [];
    lines.forEach((line, lineIndex) => {
      for (const span of getLineWordSpans(line, dk)) {
        const unit = oracle.unitOfSlot.get(span.wordId) ?? null;
        words.push({lineIndex, start: span.start, end: span.end, unit});
        if (!unit) continue;
        if (pageOrder[pageOrder.length - 1] !== unit.key) {
          pageOrder.push(unit.key);
        }
        let pages = runsOf.get(unit.key);
        if (!pages) runsOf.set(unit.key, (pages = new Map()));
        let runs = pages.get(page);
        if (!runs) pages.set(page, (runs = []));
        const last = runs[runs.length - 1];
        if (last && last.lineIndex === lineIndex) last.end = span.end;
        else runs.push({lineIndex, start: span.start, end: span.end});
      }
    });

    // Page order: the page's verses in reading order (Hafs: the base order).
    const ordered = mushafVerseMapService.getOrderedUnitKeysForPage(page);
    if (ordered.join() !== pageOrder.join()) {
      fail(`p${page}: verses [${ordered}], expected [${pageOrder}]`);
    }
    if (
      isHafs &&
      ordered.join() !==
        baseOrderedVerseKeysForPage(digitalKhattDataService, page).join()
    ) {
      fail(`p${page}: Hafs page order differs from the base`);
    }
    tick('pages');

    // Every word, both ends: exactly its verse, whole, with its payload.
    for (const word of words) {
      const u = word.unit;
      const expectedSelection = u
        ? JSON.stringify({
            rewayah,
            units: [{key: u.key, anchor: u.anchor, hafsKeys: u.hafsKeys}],
            page,
          })
        : JSON.stringify({rewayah: null, units: [], page: null});
      const expectedPayload = u
        ? JSON.stringify({
            name: 'verse-actions',
            payload: {
              verseKey: `${u.anchorSurah}:${u.anchorAyah}`,
              surahNumber: u.anchorSurah,
              ayahNumber: u.anchorAyah,
              verseKeys: u.hafsKeys.length > 1 ? u.hafsKeys : undefined,
              source: 'mushaf',
              rewayah,
              unitKeys: [u.key],
            },
          })
        : 'null';
      for (const charIndex of [word.start, word.end]) {
        press({lineIndex: word.lineIndex, charIndex});
        const s = select.getState();
        const selection = JSON.stringify({
          rewayah: s.selectedRewayah,
          units: s.selectedUnits,
          page: s.selectedPageNumber,
        });
        if (selection !== expectedSelection) {
          fail(`p${page} char ${charIndex}: selected ${selection}`);
        }
        const sheet = JSON.stringify(deps.sheet.last);
        if (sheet !== expectedPayload) {
          fail(`p${page} char ${charIndex}: sheet ${sheet}`);
        }
        tick('long-presses');
      }
      if (!u) continue;
      if (!payloadOf.has(u.key)) payloadOf.set(u.key, deps.sheet.last!.payload);
      if (isHafs) {
        // Hafs differential: exactly the payload the pages sent before.
        const {
          rewayah: r,
          unitKeys,
          ...hafsFields
        } = deps.sheet.last!.payload as Record<string, unknown>;
        if (
          JSON.stringify(hafsFields) !==
            JSON.stringify(basePayloadForKeys([u.key])) ||
          r !== 'hafs' ||
          JSON.stringify(unitKeys) !== JSON.stringify([u.key])
        ) {
          fail(`${u.key}: Hafs payload differs from the base`);
        }
      }
    }

    // The selection band of each verse on this page, from the store.
    for (const key of pageOrder) {
      const u = oracle.byKey.get(key)!;
      const runs = runsOf.get(key)!.get(page)!;
      press({lineIndex: runs[0].lineIndex, charIndex: runs[0].start});
      const s = select.getState();
      const painted = paint(page, {
        selection:
          s.selectedVerseKeys.length > 0 && s.selectedPageNumber === page
            ? {rewayah: s.selectedRewayah, verseKeys: s.selectedVerseKeys}
            : null,
      });
      const expected = new Map<number, LineHighlight[]>();
      for (const run of runs) {
        expected.set(run.lineIndex, [
          {start: run.start, end: run.end, color: COLORS.select},
        ]);
      }
      if (layersId(painted) !== layersId(expected)) {
        fail(`p${page} ${u.key}: selection band ${layersId(painted)}`);
      }
      if (
        isHafs &&
        layersId(painted) !== layersId(basePaint(page, 'selection', [key]))
      ) {
        fail(`p${page} ${u.key}: Hafs selection band differs from the base`);
      }
      tick('selection bands');
    }

    // iOS drag from the page's first verse to its last: every verse of the
    // page in reading order, opened together; back above the start: the
    // start only.
    if (pageOrder.length > 1) {
      const first = runsOf.get(pageOrder[0])!.get(page)!;
      const lastRuns = runsOf.get(pageOrder[pageOrder.length - 1])!.get(page)!;
      const lastRun = lastRuns[lastRuns.length - 1];
      hit.current = {lineIndex: first[0].lineIndex, charIndex: first[0].start};
      deps.sheet.last = null;
      select.getState().clearSelection();
      gesture.handlers!.onDragStart(0, 0);
      hit.current = {lineIndex: lastRun.lineIndex, charIndex: lastRun.end};
      gesture.handlers!.onDragUpdate(0, 0);
      const dragged = select.getState().selectedVerseKeys.join();
      if (dragged !== pageOrder.join()) {
        fail(`p${page}: drag selected [${dragged}]`);
      }
      gesture.handlers!.onDragEnd();
      const payload = lastSheet()?.payload as {unitKeys?: string[]};
      if (payload?.unitKeys?.join() !== pageOrder.join()) {
        fail(`p${page}: drag opened [${payload?.unitKeys}]`);
      }
      // A drag that goes back above its start keeps the start only.
      hit.current = {lineIndex: lastRun.lineIndex, charIndex: lastRun.end};
      gesture.handlers!.onDragStart(0, 0);
      hit.current = {lineIndex: first[0].lineIndex, charIndex: first[0].start};
      gesture.handlers!.onDragUpdate(0, 0);
      const back = select.getState().selectedVerseKeys.join();
      if (back !== pageOrder[pageOrder.length - 1]) {
        fail(`p${page}: drag back selected [${back}]`);
      }
      gesture.handlers!.onDragEnd();
      tick('drags');
    }
  }
  await act(async () => {
    view.renderer!.unmount();
  });
  select.getState().clearSelection();

  // Every verse was found on the pages and long-pressed.
  if (payloadOf.size !== oracle.units.length) {
    fail(`${payloadOf.size} of ${oracle.units.length} verses long-pressed`);
  }

  // ── 3-5. Per verse: copy, citation, playback, storage ─────────────────────
  const numberings = new Map<number, TimingNumbering>();
  const entriesOf = new Map<number, AyahTimestamp[]>();
  const numberingOf = (surah: number): TimingNumbering => {
    let numbering = numberings.get(surah);
    if (!numbering) {
      // A reciter whose timings are numbered by the rewayah itself: entry N
      // is the rewayah's verse N of the surah (Hafs: the Hafs verses).
      const count = oracle.units.filter(u => u.surah === surah).length;
      const entries: AyahTimestamp[] = Array.from({length: count}, (_, i) => ({
        surahNumber: surah,
        ayahNumber: i + 1,
        timestampFrom: (i + 1) * 1000,
        timestampTo: (i + 2) * 1000,
        durationMs: 1000,
      }));
      numbering = createTimingNumbering({
        surah,
        mode: isHafs ? 'hafs' : 'riwayah',
        reciterRewayah: rewayah,
        reason: 'end-to-end',
        entries,
        verseMap: rewayahVerseMapService,
      });
      registerTimingNumbering(entries, numbering);
      numberings.set(surah, numbering);
      entriesOf.set(surah, entries);
    }
    return numbering;
  };

  useVerseAnnotationsStore.setState({
    loadedSurahs: new Set(),
    bookmarkedVerseKeys: new Set(),
    notedVerseKeys: new Set(),
    highlights: {},
    bookmarkRows: {},
    noteRows: {},
    highlightRows: {},
  });

  for (const u of oracle.units) {
    const payload = payloadOf.get(u.key);
    if (!payload) continue;
    const unit = model?.unitByKey(u.key) ?? null;
    if (!isHafs && !unit) {
      fail(`${u.key}: no verse unit`);
      continue;
    }

    // 3. The sheet's selection, copied text and citation.
    const selection = selectVerses(
      payload as Parameters<typeof selectVerses>[0],
      isHafs ? null : model,
      'ready',
    );
    if (selection.status !== 'ready') {
      fail(`${u.key}: sheet selection ${selection.status}`);
      continue;
    }
    const ready: ReadyVerseSelection = selection;
    if (ready.keys.join() !== u.key || ready.label !== u.key) {
      fail(`${u.key}: sheet names [${ready.keys}] "${ready.label}"`);
    }
    const texts = isHafs
      ? [digitalKhattDataService.getVerseText(u.key, 'hafs')]
      : readUnitTexts(ready);
    const arabic = joinVerseTexts(texts ?? []);
    if (arabic !== u.text) {
      fail(`${u.key}: copied text differs from its slots`);
    }
    // ... and from what the pages draw for it.
    const drawn: string[] = [];
    for (const [page, runs] of runsOf.get(u.key) ?? []) {
      for (const run of runs) {
        drawn.push(
          lineTexts.get(page)![run.lineIndex].slice(run.start, run.end + 1),
        );
      }
    }
    if (drawn.join(' ') !== u.text) {
      fail(`${u.key}: the pages draw other text than its slots`);
    }
    const citation = formatQuranCitation(ready.label, rewayah);
    const cited = isHafs
      ? `Quran ${u.key}`
      : `Quran ${u.key} · ${CITED_AS[rewayah]}`;
    if (citation !== cited) fail(`${u.key}: cited as "${citation}"`);
    if (isHafs && ready.label !== formatVerseRange([u.key])) {
      fail(`${u.key}: Hafs label differs from the base`);
    }
    // Translations are Hafs-aligned: every Hafs verse it reads, once; a
    // Hafs verse it shares with another verse gets the note.
    const parts = selectionTranslationParts(ready);
    const expectedParts = u.hafsKeys.map(hafsKey => {
      const sharedWith = oracle.holders.get(hafsKey) ?? [];
      const list =
        sharedWith.length <= 2
          ? sharedWith.join(' and ')
          : `${sharedWith.slice(0, -1).join(', ')} and ${sharedWith[sharedWith.length - 1]}`;
      return {
        hafsKey,
        note:
          sharedWith.length > 1
            ? `Translation of all of Hafs ${hafsKey}, which ${CITED_AS[rewayah]} divides between verses ${list}.`
            : null,
      };
    });
    if (JSON.stringify(parts) !== JSON.stringify(expectedParts)) {
      fail(`${u.key}: translation parts ${JSON.stringify(parts)}`);
    }
    const copied = formatVerseCopyText(
      arabic,
      joinTranslationParts(parts, hafsKey => `T(${hafsKey})`),
      citation,
    );
    const expectedCopy = [
      u.text,
      expectedParts
        .flatMap(p =>
          p.note ? [`T(${p.hafsKey})`, p.note] : [`T(${p.hafsKey})`],
        )
        .join('\n'),
      cited,
    ].join('\n\n');
    if (copied !== expectedCopy) fail(`${u.key}: copied "${copied}"`);
    tick('copies');

    // 4. A reciter numbered by the rewayah: Play from here starts at the
    // verse itself, Repeat loops exactly it, the band paints exactly it.
    const numbering = numberingOf(u.surah);
    const target: AudioUnitTarget = unit
      ? toAudioUnitTarget(unit)
      : {
          rewayah: 'hafs' as const,
          surah: u.surah,
          ayah: u.ayah,
          key: u.key,
          hafsFirstAyah: u.ayah,
          hafsLastAyah: u.ayah,
        };
    const start = numbering.startEntryForUnit(target);
    const range = numbering.entryRangeForUnit(target);
    const end = numbering.endEntryAyahForUnit(target);
    if (
      start?.ayahNumber !== u.ayah ||
      range?.start !== u.ayah ||
      range?.end !== u.ayah ||
      end !== u.ayah
    ) {
      fail(
        `${u.key}: plays from ${start?.ayahNumber}, repeats ${JSON.stringify(range)}, ends ${end}`,
      );
    }
    if (numbering.unitKeysForEntry(u.ayah, rewayah).join() !== u.key) {
      fail(`${u.key}: band [${numbering.unitKeysForEntry(u.ayah, rewayah)}]`);
    }
    if (numbering.hafsKeysForEntry(u.ayah).join() !== u.hafsKeys.join()) {
      fail(`${u.key}: recites Hafs [${numbering.hafsKeysForEntry(u.ayah)}]`);
    }
    const band: PlaybackBand = {
      hafsKeys: numbering.hafsKeysForEntry(u.ayah),
      mode: numbering.mode,
      reciterRewayah: rewayah,
      entryKey: `${u.surah}:${u.ayah}`,
    };
    for (const [page, runs] of runsOf.get(u.key) ?? []) {
      const expected = new Map<number, LineHighlight[]>();
      for (const run of runs) {
        expected.set(run.lineIndex, [
          {start: run.start, end: run.end, color: COLORS.play},
        ]);
      }
      const painted = paint(page, {playback: band});
      if (layersId(painted) !== layersId(expected)) {
        fail(`p${page} ${u.key}: follow-along band ${layersId(painted)}`);
      }
      if (
        isHafs &&
        layersId(painted) !== layersId(basePaint(page, 'playback', [u.key]))
      ) {
        fail(`p${page} ${u.key}: Hafs follow-along band differs from the base`);
      }
    }
    // The main player's Play from here on the verse row (its unit; Hafs: the
    // Hafs key, as before).
    useTimestampStore.setState({
      currentSurahTimestamps: entriesOf.get(u.surah)!,
      currentTimestampKey: `e2e-${rewayah}-${u.surah}`,
      timestampRequest: {
        key: `e2e-${rewayah}-${u.surah}`,
        rewayatId: `e2e-${rewayah}`,
        surahNumber: u.surah,
      },
      timestampLoadStatus: 'ready',
    } as never);
    const fromHere = resolvePlayFromHere(unit ?? u.key);
    if (
      fromHere.status !== 'ready' ||
      fromHere.entry.ayahNumber !== u.ayah ||
      fromHere.tracking.verseKeys.join() !== u.hafsKeys.join()
    ) {
      fail(`${u.key}: main player Play from here ${JSON.stringify(fromHere)}`);
    }
    tick('playback');

    // 5. Storage: the anchor, the row a bookmark writes, what it marks, the
    // route a saved row opens, the share link.
    const anchorKey = unit ? annotationAnchor(model!, unit).verseKey : u.key;
    if (anchorKey !== u.anchor || (isHafs && anchorKey !== u.key)) {
      fail(`${u.key}: stored as ${anchorKey}, expected ${u.anchor}`);
    }
    if (unit && model!.unitForAnchor(u.anchor) !== unit) {
      fail(`${u.key}: anchor ${u.anchor} does not name it`);
    }
    if (unit && !isHafs) {
      // Through the annotations store (database mocked): one row at the
      // anchor in this rewayah, marking exactly this verse; unbookmarking
      // deletes it.
      await useVerseAnnotationsStore
        .getState()
        .setUnitsBookmarked(model!, [unit], true);
      const rows = useVerseAnnotationsStore.getState().bookmarkRows;
      if (
        JSON.stringify(rows) !==
        JSON.stringify({[u.anchor]: {verseKey: u.anchor, rewayahId: rewayah}})
      ) {
        fail(`${u.key}: bookmark rows ${JSON.stringify(rows)}`);
      }
      if (
        JSON.stringify(deps.database.lastAddBookmark) !==
        JSON.stringify([u.anchor, u.anchorSurah, u.anchorAyah, rewayah])
      ) {
        fail(`${u.key}: database row ${deps.database.lastAddBookmark}`);
      }
      const marks = selectUnitAnnotations(
        useVerseAnnotationsStore.getState(),
        model!,
      );
      if ([...marks.bookmarkedUnitKeys].join() !== u.key) {
        fail(`${u.key}: its bookmark marks [${[...marks.bookmarkedUnitKeys]}]`);
      }
      // The page tints exactly it.
      for (const [page, runs] of runsOf.get(u.key) ?? []) {
        const expected = new Map<number, LineHighlight[]>();
        for (const run of runs) {
          expected.set(run.lineIndex, [
            {start: run.start, end: run.end, color: COLORS.bookmark},
          ]);
        }
        const state = useVerseAnnotationsStore.getState();
        const painted = paint(page, {
          bookmarkedVerseKeys: state.bookmarkedVerseKeys,
          bookmarkRows: state.bookmarkRows,
        });
        if (layersId(painted) !== layersId(expected)) {
          fail(`p${page} ${u.key}: bookmark tint ${layersId(painted)}`);
        }
      }
      await useVerseAnnotationsStore
        .getState()
        .setUnitsBookmarked(model!, [unit], false);
      if (
        Object.keys(useVerseAnnotationsStore.getState().bookmarkRows).length >
          0 ||
        JSON.stringify(deps.database.lastRemoveBookmark) !==
          JSON.stringify([u.anchor])
      ) {
        fail(`${u.key}: unbookmarking left rows`);
      }
      // Notes and highlights saved at the anchor mark exactly it too.
      const noteRow = {verseKey: u.anchor, rewayahId: rewayah};
      const derived = deriveUnitAnnotations(model!, {
        bookmarks: {},
        notes: {[noteRowKey(noteRow)]: noteRow},
        highlights: {
          [u.anchor]: {verseKey: u.anchor, rewayahId: rewayah, color: 'green'},
        },
      });
      if (
        [...derived.notedUnitKeys].join() !== u.key ||
        JSON.stringify(derived.highlightColors) !==
          JSON.stringify({[u.key]: 'green'})
      ) {
        fail(`${u.key}: note / highlight rows mark other verses`);
      }
    }
    if (isHafs) {
      // Hafs rows are the Hafs keys: each marks exactly its verse.
      const hafsShown = mushafVerseMapService.getShownVerseUnits()!;
      const marked = hafsShown.unitKeysForStoredVerse({
        verseKey: u.key,
        rewayahId: 'hafs',
      });
      if (marked.join() !== u.key) fail(`${u.key}: Hafs row marks [${marked}]`);
    }
    // The saved row opens its page with exactly this verse selected
    // (/mushaf's anchor param; Hafs: today's params, no anchor).
    const page = [...(runsOf.get(u.key)?.keys() ?? [])][0];
    const params = savedVerseRouteParams(
      {
        verseKey: anchorKey,
        surahNumber: u.anchorSurah,
        ayahNumber: u.anchorAyah,
        rewayahId: rewayah,
      },
      page,
    );
    const expectedParams = isHafs
      ? {surah: String(u.surah), ayah: String(u.ayah), page: String(page)}
      : {
          surah: String(u.anchorSurah),
          ayah: String(u.anchorAyah),
          page: String(page),
          anchor: u.anchor,
        };
    if (JSON.stringify(params) !== JSON.stringify(expectedParams)) {
      fail(`${u.key}: route ${JSON.stringify(params)}`);
    }
    if (!isHafs) {
      const routeSelection = selectionForAnchor(params.anchor ?? '');
      if (
        JSON.stringify(routeSelection) !==
        JSON.stringify({
          rewayah,
          units: [{key: u.key, anchor: u.anchor, hafsKeys: u.hafsKeys}],
        })
      ) {
        fail(`${u.key}: the route selects ${JSON.stringify(routeSelection)}`);
      }
    }
    // The share link names exactly this verse (Hafs: the link of before): its
    // anchor's Hafs verse as the path, plus the anchor's word when the verse
    // starts inside that Hafs verse (the anchor names it, checked above).
    const url = anchorShareUrl(anchorKey, 'light', rewayah);
    const anchorWord = Number(u.anchor.split(':')[2] ?? 1);
    const expectedUrl = isHafs
      ? verseShareUrl(u.surah, u.ayah, 'light', 'hafs')
      : verseShareUrl(u.anchorSurah, u.anchorAyah, 'light', rewayah) +
        (anchorWord > 1 ? `&word=${anchorWord}` : '');
    if (url !== expectedUrl) {
      fail(`${u.key}: link ${url}, expected ${expectedUrl}`);
    }
    tick('storage');
  }

  // Nothing was left behind for the next DB.
  useVerseAnnotationsStore.setState({
    loadedSurahs: new Set(),
    bookmarkRows: {},
    noteRows: {},
    highlightRows: {},
    bookmarkedVerseKeys: new Set(),
    notedVerseKeys: new Set(),
    highlights: {},
  });
  report.checked.verses = oracle.units.length;
  return report;
}
