import {normalizeReciters} from './normalizeReciter';
import {resolveDefaultReciter} from '../store/settingsStore';
import type {Reciter, Rewayah} from '../types/reciter';
import {storage, writeJSON} from './storage';

const DATA_VERSION = '4';
const RECITERS_KEY = 'bayaan_reciters';
/**
 * MMKV key holding the user's default reciter id. Mirrored by the
 * `useDefaultReciter` hook, which reads this same key reactively so the
 * Home screen Quick Play rail appears once a default is seeded.
 */
export const DEFAULT_RECITER_KEY = 'bayaan_tv_default_reciter_id';
// The backend kill switch, as in the phone app (services/dataService.ts): only
// checked when EXPO_PUBLIC_KILLSWITCH_URL is set, so a build without one never
// waits on a config request before loading reciters.
const KILLSWITCH_URL = process.env.EXPO_PUBLIC_KILLSWITCH_URL ?? '';
// The TV ships no reciter data: the catalog always comes from the Bayaan API
// (the same paged /v1 API the phone uses, services/dataService.ts) and is
// kept in storage, so a TV that has loaded it once also starts offline. The
// build sets the key (EXPO_PUBLIC_BAYAAN_API_KEY) and may point elsewhere.
export const API_URL =
  process.env.EXPO_PUBLIC_BAYAAN_API_URL || 'https://api.thebayaan.com';
const API_KEY = process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? '';
const PAGE_SIZE = 200;

/** How long a fetched reciter list is used before the next fetch refreshes it. */
export const RECITERS_TTL_MS = 12 * 60 * 60 * 1000;

type Cached<T> = {version: string; data: T; savedAt?: number};

async function isBackendEnabled(): Promise<boolean> {
  if (!KILLSWITCH_URL) return true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(KILLSWITCH_URL, {signal: ctrl.signal});
    if (!res.ok) return true;
    const json = (await res.json()) as {useBackendApi?: boolean};
    return json.useBackendApi !== false;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

// The reciter list is about 500 KB of JSON and is read on every screen, so
// it is parsed once per stored value, not on every read. Comparing the raw
// string is far cheaper than parsing it and keeps the memo exact whatever
// writes the key.
let readMemo: {
  raw: string;
  cached: Cached<Reciter[]> | null;
  byId: Map<string, Reciter> | null;
} | null = null;

function readCachedReciters(): Cached<Reciter[]> | null {
  const raw = storage.getString(RECITERS_KEY);
  if (!raw) return null;
  if (readMemo?.raw !== raw) {
    let cached: Cached<Reciter[]> | null = null;
    try {
      cached = JSON.parse(raw) as Cached<Reciter[]>;
    } catch {
      cached = null;
    }
    readMemo = {raw, cached, byId: null};
  }
  const {cached} = readMemo;
  // An empty list (stored by an older build) counts as no list.
  return cached &&
    cached.version === DATA_VERSION &&
    Array.isArray(cached.data) &&
    cached.data.length > 0
    ? cached
    : null;
}

/** Stores a freshly fetched reciter list. */
function writeCachedReciters(data: Reciter[]): void {
  writeJSON<Cached<Reciter[]>>(RECITERS_KEY, {
    version: DATA_VERSION,
    data,
    savedAt: Date.now(),
  });
}

export function getCachedReciters(): Reciter[] | null {
  return readCachedReciters()?.data ?? null;
}

/** One cached reciter by id, from an index built once per stored list. */
export function getCachedReciter(reciterId: string): Reciter | undefined {
  const cached = readCachedReciters();
  if (!cached || !readMemo) return undefined;
  readMemo.byId ??= new Map(cached.data.map(r => [r.id, r]));
  return readMemo.byId.get(reciterId);
}

export function isReciterCacheFresh(
  savedAt: number | undefined,
  now: number = Date.now(),
): boolean {
  return savedAt !== undefined && now - savedAt < RECITERS_TTL_MS;
}

type CatalogPage = {data?: unknown; meta?: {total_pages?: number}};

/**
 * The whole catalog from the Bayaan API: `/v1/reciters`, paged, each page a
 * `{data, meta}` envelope. Throws on an HTTP error or a response that is not
 * that envelope, so a changed API never reads as an empty catalog.
 */
async function fetchCatalogFromApi(): Promise<Reciter[]> {
  const headers: Record<string, string> = API_KEY
    ? {Authorization: `Bearer ${API_KEY}`}
    : {};
  const all: Reciter[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${API_URL}/v1/reciters?page=${page}&limit=${PAGE_SIZE}`,
      {headers},
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as CatalogPage;
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Unexpected reciters response');
    }
    all.push(...normalizeReciters(json.data));
    const totalPages = json.meta?.total_pages;
    if (!totalPages || page >= totalPages) break;
  }
  return all;
}

// Callers that ask while a fetch is under way (App's default-reciter seed
// and the shared reciter list both ask on first launch) share it, so the
// catalog is downloaded and parsed once.
let inFlight: Promise<Reciter[]> | null = null;

/**
 * The reciter catalog: the stored copy while it is fresh, otherwise the API's.
 * A list older than RECITERS_TTL_MS is refreshed; if that fails the stale
 * copy is returned. Rejects only when there is no copy at all and the API
 * can't be reached, which the app shows as its offline screen.
 */
export function fetchReciters(opts?: {
  skipCache?: boolean;
}): Promise<Reciter[]> {
  if (!opts?.skipCache) {
    const cached = readCachedReciters();
    if (cached && isReciterCacheFresh(cached.savedAt)) {
      return Promise.resolve(cached.data);
    }
  }
  inFlight ??= loadReciters().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function loadReciters(): Promise<Reciter[]> {
  try {
    // The kill switch pauses API calls; the stored list keeps serving.
    if (!(await isBackendEnabled())) throw new Error('Backend disabled');
    const data = await fetchCatalogFromApi();
    // An empty catalog is a broken response, not a catalog: never store it
    // as fresh over a good list.
    if (data.length === 0) throw new Error('Empty reciters response');
    writeCachedReciters(data);
    return data;
  } catch (error) {
    const cached = getCachedReciters();
    if (cached) return cached;
    throw error;
  }
}

/**
 * A reciter's rewayat, read from the stored catalog. Older
 * builds kept a per-reciter copy under `bayaan_reciter_servers_<id>`; it is
 * no longer read or written, because that copy never refreshed with the
 * catalog and would keep serving a reciter's old audio servers after a live
 * catalog update changed them.
 */
export function getCachedRewayat(reciterId: string): Rewayah[] | null {
  const embedded = getCachedReciter(reciterId)?.rewayat;
  return embedded && embedded.length > 0 ? embedded : null;
}

/**
 * A reciter's rewayat. The API has no per-reciter endpoint: every reciter
 * comes with its rewayat in the catalog (see fetchCatalogFromApi), so this
 * reads them from the stored catalog.
 */
export async function fetchRewayat(reciterId: string): Promise<Rewayah[]> {
  return getCachedRewayat(reciterId) ?? [];
}

export function buildAudioUrl(server: string, surahNumber: number): string {
  const base = server.endsWith('/') ? server.slice(0, -1) : server;
  const padded = String(surahNumber).padStart(3, '0');
  return `${base}/${padded}.mp3`;
}

/**
 * Pick a sensible default reciter for first-launch Quick Play: the first
 * featured reciter, otherwise the first reciter in the list. Returns null only
 * when the list is empty.
 */
export function getDefaultReciter(reciters: Reciter[]): Reciter | null {
  if (reciters.length === 0) return null;
  const featured = reciters.find(r => r.is_featured);
  return featured ?? reciters[0];
}

/**
 * On first launch (no persisted default reciter), resolve a default via
 * getDefaultReciter and persist its id so Quick Play works without history.
 * No-op when a default is already set. Returns the resolved id, or null when
 * no reciter could be resolved.
 */
export async function seedDefaultReciter(): Promise<string | null> {
  const existing = storage.getString(DEFAULT_RECITER_KEY);
  if (existing && existing.length > 0) return existing;
  // A list fetch already under way (useReciters asks too) is shared. Offline
  // with no stored list, there is nothing to seed until the catalog loads.
  const reciters =
    getCachedReciters() ?? (await fetchReciters().catch(() => []));
  // Honour the persisted Settings picker choice when it matches a known
  // reciter; otherwise fall back to the featured/first default.
  const reciter = resolveDefaultReciter(reciters, getDefaultReciter);
  if (!reciter) return null;
  storage.set(DEFAULT_RECITER_KEY, reciter.id);
  return reciter.id;
}
