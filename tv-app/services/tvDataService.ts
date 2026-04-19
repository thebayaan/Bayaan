import fallbackReciters from '../../data/reciters-fallback.json';
import type {Reciter, Rewayah} from '../types/reciter';
import {readJSON, storage, writeJSON} from './storage';

const DATA_VERSION = '4';
const RECITERS_KEY = 'bayaan_reciters';
const SERVERS_KEY = 'bayaan_reciter_servers';
const CDN_CONFIG_URL = 'https://cdn.example.com/config/app-config.json';
const API_URL = process.env.EXPO_PUBLIC_BAYAAN_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_BAYAAN_API_KEY ?? '';

type Cached<T> = {version: string; data: T};

async function isBackendEnabled(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(CDN_CONFIG_URL, {signal: ctrl.signal});
    clearTimeout(timer);
    if (!res.ok) return true;
    const json = (await res.json()) as {useBackendApi?: boolean};
    return json.useBackendApi !== false;
  } catch {
    return true;
  }
}

export function getCachedReciters(): Reciter[] | null {
  const cached = readJSON<Cached<Reciter[]>>(RECITERS_KEY);
  if (!cached || cached.version !== DATA_VERSION) return null;
  return cached.data;
}

export async function fetchReciters(opts?: {
  skipCache?: boolean;
}): Promise<Reciter[]> {
  if (!opts?.skipCache) {
    const cached = getCachedReciters();
    if (cached) return cached;
  }

  const enabled = API_URL ? await isBackendEnabled() : false;
  if (!enabled) {
    const data = fallbackReciters as Reciter[];
    writeJSON<Cached<Reciter[]>>(RECITERS_KEY, {version: DATA_VERSION, data});
    return data;
  }

  try {
    const res = await fetch(`${API_URL}/reciters`, {
      headers: API_KEY ? {Authorization: `Bearer ${API_KEY}`} : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Reciter[];
    writeJSON<Cached<Reciter[]>>(RECITERS_KEY, {version: DATA_VERSION, data});
    return data;
  } catch {
    const cached = getCachedReciters();
    if (cached) return cached;
    const data = fallbackReciters as Reciter[];
    writeJSON<Cached<Reciter[]>>(RECITERS_KEY, {version: DATA_VERSION, data});
    return data;
  }
}

export async function fetchRewayat(reciterId: string): Promise<Rewayah[]> {
  const key = `${SERVERS_KEY}_${reciterId}`;
  const cached = readJSON<Cached<Rewayah[]>>(key);
  if (cached && cached.version === DATA_VERSION && cached.data.length > 0) {
    return cached.data;
  }

  const embedded = getCachedReciters()?.find(r => r.id === reciterId)?.rewayat;
  if (embedded && embedded.length > 0) {
    writeJSON<Cached<Rewayah[]>>(key, {version: DATA_VERSION, data: embedded});
    return embedded;
  }

  if (!API_URL) {
    const fromFallback = (fallbackReciters as Reciter[]).find(
      r => r.id === reciterId,
    )?.rewayat;
    return fromFallback ?? [];
  }
  try {
    const res = await fetch(`${API_URL}/reciters/${reciterId}/rewayat`, {
      headers: API_KEY ? {Authorization: `Bearer ${API_KEY}`} : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Rewayah[];
    writeJSON<Cached<Rewayah[]>>(key, {version: DATA_VERSION, data});
    return data;
  } catch {
    return [];
  }
}

export function buildAudioUrl(server: string, surahNumber: number): string {
  const base = server.endsWith('/') ? server.slice(0, -1) : server;
  const padded = String(surahNumber).padStart(3, '0');
  return `${base}/${padded}.mp3`;
}
