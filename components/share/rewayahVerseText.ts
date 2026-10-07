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
 */
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {
  getShortLabel,
  hasTextData,
  type RewayahId,
} from '@/services/rewayah/RewayahIdentity';

/** How long copy/share waits for a rewayah's words DB before giving up. */
export const REWAYAH_TEXT_TIMEOUT_MS = 10000;

export type VerseTextsResult =
  | {status: 'ready'; rewayah: RewayahId; texts: string[]}
  | {status: 'loading'; rewayah: RewayahId}
  | {status: 'unavailable'; rewayah: RewayahId};

/**
 * True once the requested rewayah's words are in memory for every key. Every
 * words DB keeps the Hafs rows (one row per Hafs word slot, blank or not), so
 * an empty word list for a valid verse key means "not loaded yet", never
 * "this verse has no words".
 */
export function isRewayahTextLoaded(
  verseKeys: readonly string[],
  rewayah: RewayahId,
): boolean {
  if (!hasTextData(rewayah)) return false;
  for (const vk of verseKeys) {
    if (digitalKhattDataService.getVerseWords(vk, rewayah).length === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Synchronous read. Returns one text per key (a verse whose slots are all
 * blank in this rewayah yields '') when the rewayah's words are loaded, and
 * null otherwise. Never substitutes another rewayah.
 */
export function readLoadedVerseTexts(
  verseKeys: readonly string[],
  rewayah: RewayahId,
): string[] | null {
  if (!isRewayahTextLoaded(verseKeys, rewayah)) return null;
  return verseKeys.map(vk => digitalKhattDataService.getVerseText(vk, rewayah));
}

/**
 * Calls `onSettled(true)` as soon as the rewayah's words are in memory, or
 * `onSettled(false)` when the load fails or `timeoutMs` passes first. Starts
 * a side-cache load whenever the rewayah is not the active one; while it is
 * the active one (still initializing or mid-switch) it waits for the
 * service's next cache change. Returns a function that stops waiting (a side
 * load already started still completes inside the service).
 */
export function watchRewayahText(
  verseKeys: readonly string[],
  rewayah: RewayahId,
  onSettled: (loaded: boolean) => void,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): () => void {
  const noop = () => undefined;
  if (isRewayahTextLoaded(verseKeys, rewayah)) {
    onSettled(true);
    return noop;
  }
  if (!hasTextData(rewayah)) {
    onSettled(false);
    return noop;
  }

  let done = false;
  let sideLoadStarted = false;
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
    if (isRewayahTextLoaded(verseKeys, rewayah)) {
      settle(true);
      return;
    }
    if (sideLoadStarted || rewayah === digitalKhattDataService.rewayah) {
      return;
    }
    sideLoadStarted = true;
    digitalKhattDataService.ensureRewayahLoaded(rewayah).then(check, err => {
      if (done) return;
      console.warn(`[rewayahVerseText] Could not load ${rewayah}:`, err);
      // A main-cache switch to this rewayah may have landed meanwhile;
      // give up only if the text is still missing.
      settle(isRewayahTextLoaded(verseKeys, rewayah));
    });
  };

  unsubscribe = digitalKhattDataService.subscribeCacheChanges(check);
  timer = setTimeout(
    () => settle(isRewayahTextLoaded(verseKeys, rewayah)),
    timeoutMs,
  );
  check();
  return () => {
    if (!done) stop();
  };
}

/** Promise form of watchRewayahText. */
export function waitForRewayahText(
  verseKeys: readonly string[],
  rewayah: RewayahId,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    watchRewayahText(verseKeys, rewayah, resolve, timeoutMs);
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

/** What a caller gets once loading has failed or timed out. */
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
 * non-Hafs rewayah whose words could not be loaded. Never 'loading'.
 */
export async function resolveVerseTexts(
  verseKeys: readonly string[],
  rewayah: RewayahId,
  timeoutMs: number = REWAYAH_TEXT_TIMEOUT_MS,
): Promise<VerseTextsResult> {
  const loaded = await waitForRewayahText(verseKeys, rewayah, timeoutMs);
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
 * Verse reference for a selection: "2:255", "2:255-257" or "2:286 - 3:2".
 * Uses the app's verse keys (Hafs numbering) for every rewayah. A rewayah
 * may number the same verse differently; switching references to rewayah
 * numbering is an open product decision and should change only here.
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
