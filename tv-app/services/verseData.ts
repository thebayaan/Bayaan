/**
 * Verse text, translations and timings for the listening room.
 *
 * The Arabic text ships with the app (the phone app's `data/quran.json`, text
 * only) so a verse can show before anything loads. Translations and verse
 * timings stream per surah and are cached in MMKV, so a surah you've played
 * once works offline and opens instantly.
 */
import {readJSON, writeJSON} from './storage';
import type {TimingEntry} from './verseTimeline';

export const TIMESTAMP_CDN = 'https://cdn.thebayaan.com/timestamps';
export const TRANSLATION_API = 'https://api.alquran.cloud/v1';

/** Saheeh International, the phone app's default English translation. */
export const DEFAULT_TRANSLATION = 'en.sahih';

/** Don't re-ask the CDN about a surah it had no timings for until this passes. */
const MISSING_RETRY_MS = 24 * 60 * 60 * 1000;

type QuranVerse = {surah_number: number; ayah_number: number; text: string};

let versesBySurah: Map<number, string[]> | null = null;

function loadQuran(): Map<number, string[]> {
  if (versesBySurah) return versesBySurah;
  // Required lazily: the text is a couple of MB and only the player needs it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const quran = require('../../data/quran.json') as Record<string, QuranVerse>;
  const map = new Map<number, string[]>();
  for (const verse of Object.values(quran)) {
    let list = map.get(verse.surah_number);
    if (!list) {
      list = [];
      map.set(verse.surah_number, list);
    }
    list[verse.ayah_number - 1] = verse.text;
  }
  versesBySurah = map;
  return map;
}

/** Arabic text of every verse in a surah, verse 1 first. */
export function getArabicVerses(surahNumber: number): string[] {
  return loadQuran().get(surahNumber) ?? [];
}

/** The basmala as written in Al-Fatihah 1:1, without its verse number. */
export function getBasmala(): string {
  const first = getArabicVerses(1)[0] ?? '';
  return first.replace(/\s*[٠-٩]+\s*$/, '');
}

type CachedTimings = {entries: TimingEntry[]} | {missingAt: number};

function timingsKey(rewayahId: string, surahNumber: number): string {
  return `bayaan_tv_ts_${rewayahId}_${surahNumber}`;
}

function isTimingEntry(x: unknown): x is TimingEntry {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.surahNumber === 'number' &&
    typeof o.ayahNumber === 'number' &&
    typeof o.timestampFrom === 'number' &&
    typeof o.timestampTo === 'number'
  );
}

/**
 * Verse timings for one recitation of a surah, or null when the CDN has none
 * (not every reciter is timed). Network errors are thrown so the caller can
 * tell "no timings" from "offline".
 */
export async function fetchTimings(
  rewayahId: string,
  surahNumber: number,
  fetchImpl: typeof fetch = fetch,
): Promise<TimingEntry[] | null> {
  const key = timingsKey(rewayahId, surahNumber);
  const cached = readJSON<CachedTimings>(key);
  if (cached && 'entries' in cached) return cached.entries;
  if (cached && Date.now() - cached.missingAt < MISSING_RETRY_MS) return null;

  const padded = String(surahNumber).padStart(3, '0');
  const res = await fetchImpl(`${TIMESTAMP_CDN}/${rewayahId}/${padded}.json`);
  if (res.status === 404 || res.status === 403) {
    writeJSON<CachedTimings>(key, {missingAt: Date.now()});
    return null;
  }
  if (!res.ok) throw new Error(`Timings request failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0 || !isTimingEntry(json[0])) {
    writeJSON<CachedTimings>(key, {missingAt: Date.now()});
    return null;
  }
  const entries = json as TimingEntry[];
  writeJSON<CachedTimings>(key, {entries});
  return entries;
}

function translationKey(edition: string, surahNumber: number): string {
  return `bayaan_tv_tr_${edition}_${surahNumber}`;
}

type TranslationResponse = {
  data?: {ayahs?: {numberInSurah: number; text: string}[]};
};

/**
 * A translated verse as shown. Saheeh International (as alquran.cloud serves
 * it) ends a verse whose sentence runs on into the next with " -"; on screen,
 * one verse at a time, that reads as a stray dash, so it is dropped.
 */
export function cleanTranslationVerse(text: string): string {
  return text.replace(/\s+[-–—]\s*$/, '').trim();
}

/** A surah's translation, verse 1 first. Thrown errors mean offline or down. */
export async function fetchTranslation(
  edition: string,
  surahNumber: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const key = translationKey(edition, surahNumber);
  const cached = readJSON<string[]>(key);
  // Cleaned on read too, so surahs cached before the cleanup show clean.
  // A verse missing from the response was cached as null: keep it missing.
  if (cached && cached.length > 0) {
    return cached.map(v =>
      typeof v === 'string' ? cleanTranslationVerse(v) : v,
    );
  }

  const res = await fetchImpl(
    `${TRANSLATION_API}/surah/${surahNumber}/${encodeURIComponent(edition)}`,
  );
  if (!res.ok) throw new Error(`Translation request failed (${res.status})`);
  const json = (await res.json()) as TranslationResponse;
  const ayahs = json.data?.ayahs ?? [];
  const verses: string[] = [];
  for (const a of ayahs) {
    verses[a.numberInSurah - 1] = cleanTranslationVerse(a.text);
  }
  if (verses.length === 0) throw new Error('Translation response was empty');
  writeJSON(key, verses);
  return verses;
}
