// @ai-generated
/**
 * Rewayah-honest verse text for copy, share and previews.
 *
 * Every surface that copies, shares or previews verse text labels it with a
 * rewayah, so the text must be that rewayah's text. Words for a rewayah other
 * than the active mushaf one live in a side cache of the DigitalKhatt data
 * service that loads asynchronously, and a synchronous read made before the
 * load finishes comes back empty. Older code then fell back to the static
 * Hafs JSON while still labelling the result with the requested rewayah.
 *
 * This module never does that. Non-Hafs text comes only from that rewayah's
 * words DB: callers either wait for it (bounded by a timeout) or learn that it
 * could not be loaded and tell the user. Only a Hafs request may fall back to
 * the bundled Hafs JSON, because that text is Hafs.
 *
 * Joining the words of one verse is the data service's job (getVerseText
 * skips blank word slots); this module only joins whole verses.
 *
 * Whether a rewayah's text is loaded comes from the data service's load
 * state, never from a verse's word list: under the Release 1 slot model a
 * loaded verse can legitimately have no visible words in a rewayah (every
 * slot blank because its words are read with a neighbouring verse), and such
 * a verse must not hold a copy or a preview hostage.
 */
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getShortLabel,
  hasTextData,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

/** How long copy/share waits for a rewayah's words DB before giving up. */
export const REWAYAH_TEXT_TIMEOUT_MS = 10000;

/** Load requests one wait may make (see watchRewayahText). */
const MAX_LOAD_REQUESTS = 2;

export type VerseTextsResult =
  | {status: 'ready'; rewayah: RewayahId; texts: string[]}
  | {status: 'loading'; rewayah: RewayahId}
  | {status: 'unavailable'; rewayah: RewayahId};

/**
 * True once `rewayah`'s words are in memory (the active main cache or a side
 * cache), per the data service's load state. Every verse key of a loaded
 * rewayah is readable then, including a verse with no visible words.
 */
export function isRewayahTextLoaded(rewayah: RewayahId): boolean {
  return (
    hasTextData(rewayah) && digitalKhattDataService.isRewayahReady(rewayah)
  );
}

/**
 * True when Hafs was requested but its words failed to load (the startup
 * load or a side load). The bundled Hafs JSON is then served at once instead
 * of waiting for a load that is not coming.
 */
export function isHafsTextFailed(rewayah: RewayahId): boolean {
  return (
    rewayah === 'hafs' &&
    digitalKhattDataService.getRewayahLoadState('hafs') === 'error'
  );
}

/**
 * Synchronous read. Returns one text per key when the rewayah's words are
 * loaded (a verse with no visible words in this rewayah yields ''), and null
 * otherwise. Never substitutes another rewayah.
 */
export function readLoadedVerseTexts(
  verseKeys: readonly string[],
  rewayah: RewayahId,
): string[] | null {
  if (!isRewayahTextLoaded(rewayah)) return null;
  return verseKeys.map(vk => digitalKhattDataService.getVerseText(vk, rewayah));
}

/**
 * True when a selection of one or more verses has no words of its own in
 * this rewayah: every text is ''. (An empty selection is not such a case.)
 */
export function hasNoOwnText(texts: readonly string[]): boolean {
  return texts.length > 0 && texts.every(text => text.length === 0);
}

/**
 * Why a loaded selection has no text: under the Release 1 slot model a Hafs
 * verse whose slots are all blank in a rewayah is read there as part of a
 * neighbouring verse. No bundled words DB has such a verse today; copy and
 * share say this rather than sharing a bare citation.
 */
export function noOwnTextMessage(rewayah: RewayahId): string {
  return `In ${getShortLabel(rewayah)}, this selection is read as part of a neighboring verse.`;
}

/**
 * Calls `onSettled(true)` as soon as the rewayah's words are in memory, or
 * `onSettled(false)` when the load fails or `timeoutMs` passes first. Asks the
 * data service for the words (ensureRewayahLoaded waits for an initial load
 * or a switch already bringing them, and otherwise starts a side load) and
 * settles as soon as that request does. A Hafs request whose words already
 * failed to load settles at once. Returns a function that stops waiting (a
 * load already started still completes inside the service).
 */
export function watchRewayahText(
  rewayah: RewayahId,
  onSettled: (loaded: boolean) => void,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): () => void {
  const noop = () => undefined;
  if (isRewayahTextLoaded(rewayah)) {
    onSettled(true);
    return noop;
  }
  if (!hasTextData(rewayah) || isHafsTextFailed(rewayah)) {
    onSettled(false);
    return noop;
  }

  let done = false;
  let requested = false;
  let requests = 0;
  let unsubscribe: () => void = noop;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    done = true;
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
  };
  const settle = (loaded: boolean) => {
    if (done) return;
    stop();
    onSettled(loaded);
  };
  const check = () => {
    if (done) return;
    if (isRewayahTextLoaded(rewayah)) {
      settle(true);
      return;
    }
    if (requested) return;
    // ensureRewayahLoaded resolves once the words are readable, so a second
    // request only covers words dropped again in between (a mushaf switch
    // evicting a side copy). Never more: a request that resolves at once
    // must not turn into a loop that starves the timeout.
    if (requests >= MAX_LOAD_REQUESTS) {
      settle(false);
      return;
    }
    requests += 1;
    requested = true;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).then(
      () => {
        requested = false;
        check();
      },
      err => {
        if (done) return;
        console.warn(`[rewayahVerseText] Could not load ${rewayah}:`, err);
        // A main-cache switch to this rewayah may have landed meanwhile;
        // give up only if the text is still missing.
        settle(isRewayahTextLoaded(rewayah));
      },
    );
  };

  unsubscribe = digitalKhattDataService.subscribeCacheChanges(check);
  timer = setTimeout(() => settle(isRewayahTextLoaded(rewayah)), timeoutMs);
  check();
  return () => {
    if (!done) stop();
  };
}

/** Promise form of watchRewayahText. */
export function waitForRewayahText(
  rewayah: RewayahId,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    watchRewayahText(rewayah, resolve, timeoutMs);
  });
}

let hafsJsonByKey: Map<string, string> | null = null;

/**
 * Hafs text from the bundled Quran JSON, used only when a Hafs request cannot
 * be served from the DigitalKhatt words DB.
 */
export function getBundledHafsVerseText(verseKey: string): string {
  if (!hafsJsonByKey) {
    const raw = require('@/data/quran.json') as Record<
      string,
      {verse_key?: string; text?: string}
    >;
    hafsJsonByKey = new Map();
    for (const entry of Object.values(raw)) {
      if (entry?.verse_key && entry.text) {
        hafsJsonByKey.set(entry.verse_key, entry.text);
      }
    }
  }
  return hafsJsonByKey.get(verseKey) ?? '';
}

/** What a caller gets once loading has failed or timed out (at once for a
 *  Hafs request whose words failed to load). */
export function unavailableResult(
  verseKeys: readonly string[],
  rewayah: RewayahId,
): VerseTextsResult {
  if (rewayah === 'hafs') {
    return {
      status: 'ready',
      rewayah: 'hafs',
      texts: verseKeys.map(getBundledHafsVerseText),
    };
  }
  return {status: 'unavailable', rewayah};
}

/**
 * Async read for copy/share actions: waits (bounded) for the rewayah's text.
 * The result is 'ready' with that rewayah's text, or 'unavailable' for a
 * non-Hafs rewayah whose words could not be loaded. Never 'loading'. A 'ready'
 * result can hold only '' texts when no selected verse has words of its own
 * in this rewayah (see hasNoOwnText).
 */
export async function resolveVerseTexts(
  verseKeys: readonly string[],
  rewayah: RewayahId,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<VerseTextsResult> {
  const loaded = await waitForRewayahText(rewayah, timeoutMs);
  const texts = loaded ? readLoadedVerseTexts(verseKeys, rewayah) : null;
  if (texts) return {status: 'ready', rewayah, texts};
  return unavailableResult(verseKeys, rewayah);
}

/** True when the text ends at a verse end (a verse number, with or without
 *  the U+06DD sign; the bundled Hafs JSON writes bare digits). */
function endsAtVerseEnd(text: string): boolean {
  return /[\u0660-\u0669]$/.test(text);
}

/**
 * Joins consecutive verse texts for copy and share. A line break follows a
 * verse that ends with its number; otherwise the next verse continues on the
 * same line. Rewayat number verses differently from Hafs: where a rewayah
 * verse spans two Hafs verses, the first Hafs verse has no number and the
 * reading continues, so a line break there would split the rewayah verse.
 */
export function joinVerseTexts(texts: readonly string[]): string {
  let out = '';
  for (const text of texts) {
    if (!text) continue;
    if (out) out += endsAtVerseEnd(out) ? '\n' : ' ';
    out += text;
  }
  return out;
}

/**
 * Verse reference for a selection of Hafs verse keys: "2:255", "2:255-257"
 * or "2:286 - 3:2". Decision 3 (Release 1): a rewayah's verses are labelled
 * in its own numbering, with formatUnitRangeLabel (same format) through
 * rewayahVerseSelection.ts; this labels Hafs selections only, whose verse
 * keys are their own numbers.
 */
export function formatVerseRange(verseKeys: readonly string[]): string {
  if (verseKeys.length === 0) return '';
  const first = verseKeys[0];
  const last = verseKeys[verseKeys.length - 1];
  const [firstSurah, firstAyah] = first.split(':');
  const [lastSurah, lastAyah] = last.split(':');
  if (first === last) return `${firstSurah}:${firstAyah}`;
  if (firstSurah === lastSurah) {
    return `${firstSurah}:${firstAyah}-${lastAyah}`;
  }
  return `${firstSurah}:${firstAyah} - ${lastSurah}:${lastAyah}`;
}

/**
 * Citation line for copied or shared text: "Quran 2:255" for Hafs and
 * "Quran 2:255 · Warsh" otherwise. `rewayah` must be the rewayah the text
 * came from.
 */
export function formatQuranCitation(
  reference: string,
  rewayah: RewayahId,
): string {
  const base = `Quran ${reference}`;
  return rewayah === 'hafs' ? base : `${base} · ${getShortLabel(rewayah)}`;
}
