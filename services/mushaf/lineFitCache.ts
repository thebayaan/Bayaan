// @ai-generated
/**
 * Line fits (RFC-023 step 4). SkiaLine builds a justified line, measures it,
 * and builds it again with its fit (justifiedSpace.ts). The fit is kept in two
 * tiers: a map for the session, and an MMKV store for the next launch of the
 * same bundle. A fit read from the store goes into the map, so a line reads the
 * store at most once in a launch.
 *
 * MushafPreloadService opens the store at start-up, so no render opens or
 * clears it. Until then, and in a dev bundle, only the map is used. The store
 * is a cache only: after any failure in it, the line is measured again.
 */
import * as Updates from 'expo-updates';
import type {MMKV} from 'react-native-mmkv';
import {readVersionInfo} from '@/utils/appVersion';
import {openVersionedMMKV} from '@/utils/versionedMMKV';

/**
 * Change this when the fit pass (SkiaLine), JustificationService or a font
 * changes the drawn width of a line.
 */
const LINE_FIT_FORMAT = 1;

/** A line's fit: the words' font size and the px added to every space. */
export interface LineFit {
  wordSize: number;
  spaceExtra: number;
}

/** Fits in the session map: about 130 pages of 15 lines. */
const SESSION_LIMIT = 2000;

/**
 * Fits in the store: about three whole Mushafs of 9,046 lines, about 1.5 MB.
 * The limit is checked when the store opens, so a store over it starts again
 * at the next launch. Within one launch the store is not bounded: each line
 * fitted adds one entry of about 50 bytes.
 */
const STORE_LIMIT = 30000;

/** A fit's key is a base36 hash (hashKey), so no fit has this name. */
const VERSION_KEY = '#version';

const fits = new Map<string, LineFit>();
let store: MMKV | null = null;
let openTried = false;

/**
 * The update id. With updates off, the build version and its commit, since the
 * build number is a commit count and two branches can share it. Null without
 * both.
 */
function currentBundle(): string | null {
  if (Updates.updateId) return Updates.updateId;
  const v = readVersionInfo();
  return v?.gitHash
    ? `${v.semanticVersion}-${v.buildNumber}-${v.gitHash}`
    : null;
}

/**
 * Opens the store of this bundle, once a session. Another bundle or format, or
 * a store over STORE_LIMIT, starts empty.
 */
export function openLineFitCache(): void {
  // A dev bundle changes with no new update id or build version.
  if (openTried || __DEV__) return;
  openTried = true;
  try {
    const bundle = currentBundle();
    if (!bundle) return;
    store = openVersionedMMKV({
      id: 'mushaf-line-fits',
      versionKey: VERSION_KEY,
      version: `${LINE_FIT_FORMAT}:${bundle}`,
      maxKeys: STORE_LIMIT,
    }).mmkv;
  } catch {
    store = null;
  }
}

/* eslint-disable no-bitwise */
/**
 * cyrb53, a 53-bit string hash. A fit key holds the line text and its font
 * features, so the store keeps the hash and not the key. With 30,000 lines, the
 * chance of one collision is about 1 in 20 million. A collision can only give
 * one line the wrong width, and only until the next bundle.
 */
function hashKey(key: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
/* eslint-enable no-bitwise */

/**
 * A valid fit has a positive word size. spaceExtra is 0 on a line that fits and
 * negative on a line that overshoots (spaceFitExtra), so it only has to be
 * finite.
 */
function isUsableFit({wordSize, spaceExtra}: LineFit): boolean {
  return (
    Number.isFinite(wordSize) && wordSize > 0 && Number.isFinite(spaceExtra)
  );
}

function readStoredFit(key: string): LineFit | undefined {
  try {
    const parts = store?.getString(hashKey(key))?.split(',');
    if (parts?.length !== 2) return undefined;
    // Number, not parseFloat, which reads '20abc' as 20. Number reads '' as 0,
    // so an empty half is not a number either.
    const [wordSize, spaceExtra] = parts.map(part =>
      part.trim() === '' ? NaN : Number(part),
    );
    const fit = {wordSize, spaceExtra};
    return isUsableFit(fit) ? fit : undefined;
  } catch {
    return undefined;
  }
}

/** Puts a fit last in the session map, and drops the oldest over the limit. */
function remember(key: string, fit: LineFit): void {
  fits.delete(key);
  fits.set(key, fit);
  if (fits.size > SESSION_LIMIT) {
    const oldest = fits.keys().next().value;
    if (oldest !== undefined) fits.delete(oldest);
  }
}

/** The fit of the line `key` names (lineFitKey), from the session or the store. */
export function getLineFit(key: string): LineFit | undefined {
  const fit = fits.get(key) ?? readStoredFit(key);
  if (fit) remember(key, fit);
  return fit;
}

/**
 * Keeps a line's fit for the session and for the next launch. The write is
 * direct: a deferred write ran on the same JS thread. A fit that is not valid
 * stays in the session only.
 */
export function setLineFit(key: string, fit: LineFit): void {
  remember(key, fit);
  if (!store || !isUsableFit(fit)) return;
  try {
    store.set(hashKey(key), `${fit.wordSize},${fit.spaceExtra}`);
  } catch {
    // A cache only: the line is measured again at the next launch.
  }
}

/** Drops every fit of the session (tests). The store keeps its fits. */
export function clearLineFits(): void {
  fits.clear();
}

/**
 * Key of a line's fit: everything that sets its drawn width. `features` is
 * the justification's per-character font features (index -> features).
 */
export function lineFitKey(
  lineText: string,
  fontFamily: string,
  fontSize: number,
  lineWidth: number,
  justification: {
    simpleSpacing: number;
    ayaSpacing: number;
    fontSizeRatio: number;
    fontFeatures: ReadonlyMap<
      number,
      ReadonlyArray<{name: string; value: number}>
    >;
  },
): string {
  let features = '';
  for (const [index, list] of justification.fontFeatures) {
    features += `${index}:`;
    for (const f of list) features += `${f.name}=${f.value},`;
    features += ';';
  }
  return [
    fontFamily,
    fontSize,
    lineWidth,
    justification.fontSizeRatio,
    justification.simpleSpacing,
    justification.ayaSpacing,
    features,
    lineText,
  ].join('|');
}
