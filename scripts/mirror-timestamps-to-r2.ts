/**
 * mirror-timestamps-to-r2.ts
 *
 * One-shot mirror of ayah timestamps from mp3quran + QDC into R2.
 *
 * Output layout: bayaan-audio/timestamps/{rewayat_id}/{NNN}.json
 * Each JSON is an AyahTimestamp[] in the mobile app's canonical shape.
 *
 * Usage:
 *   npm run mirror:timestamps -- [--dry-run] [--rewayat=<id>] [--skip-existing]
 *
 * Required env:
 *   BAYAAN_API_URL, BAYAAN_API_KEY (in .env or .env.r2)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (in .env.r2)
 */

import * as fs from 'fs';
import * as path from 'path';
import {uploadJson, objectExists} from './lib/r2-client';
import {fetchMp3QuranSurah, fetchQdcSurah} from './lib/timestamp-sources';
import type {AyahTimestamp} from '../types/timestamps';

const CONCURRENCY = 8;
const REPORT_PATH = path.resolve(process.cwd(), 'scripts/.mirror-timestamps-report.json');

interface RewayatInfo {
  id: string;
  reciter_name: string;
  rewayat_name: string;
  style: string;
  mp3quran_read_id: number | null;
  qdc_reciter_id: number | null;
}

interface SurahResult {
  rewayatId: string;
  surahNumber: number;
  status: 'uploaded' | 'skipped' | 'empty' | 'error';
  message?: string;
  ayahCount?: number;
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipExisting = args.has('--skip-existing');
const filterArg = process.argv.find(a => a.startsWith('--rewayat='));
const filterRewayatId = filterArg ? filterArg.split('=')[1] : null;

function loadEnv() {
  for (const file of ['.env', '.env.r2']) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      const cleanKey = k.replace(/^EXPO_PUBLIC_/, '');
      if (!process.env[cleanKey]) process.env[cleanKey] = v;
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const API_URL = process.env.BAYAAN_API_URL || process.env.EXPO_PUBLIC_BAYAAN_API_URL;
const API_KEY = process.env.BAYAAN_API_KEY || process.env.EXPO_PUBLIC_BAYAAN_API_KEY;

if (!API_URL || !API_KEY) {
  throw new Error('Set BAYAAN_API_URL and BAYAAN_API_KEY (or EXPO_PUBLIC_* equivalents).');
}

async function fetchAllRewayat(): Promise<RewayatInfo[]> {
  const all: RewayatInfo[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_URL}/v1/reciters?page=${page}&limit=200`, {
      headers: {Authorization: `Bearer ${API_KEY}`},
    });
    if (!res.ok) throw new Error(`reciters fetch ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      data: Array<{
        name: string;
        rewayat: Array<{
          id: string;
          name: string;
          style: string;
          mp3quran_read_id: number | null;
          qdc_reciter_id: number | null;
        }>;
      }>;
      meta: {total_pages: number};
    };
    for (const r of json.data) {
      for (const rw of r.rewayat) {
        all.push({
          id: rw.id,
          reciter_name: r.name,
          rewayat_name: rw.name,
          style: rw.style,
          mp3quran_read_id: rw.mp3quran_read_id,
          qdc_reciter_id: rw.qdc_reciter_id,
        });
      }
    }
    if (page >= json.meta.total_pages) break;
    page++;
  }
  return all;
}

async function mirrorSurah(
  rw: RewayatInfo,
  surahNumber: number,
): Promise<SurahResult> {
  const key = `timestamps/${rw.id}/${String(surahNumber).padStart(3, '0')}.json`;

  if (skipExisting && !dryRun) {
    if (await objectExists(key)) {
      return {rewayatId: rw.id, surahNumber, status: 'skipped'};
    }
  }

  let data: AyahTimestamp[] = [];
  try {
    if (rw.mp3quran_read_id) {
      data = await fetchMp3QuranSurah(rw.mp3quran_read_id, surahNumber);
    } else if (rw.qdc_reciter_id) {
      data = await fetchQdcSurah(rw.qdc_reciter_id, surahNumber);
    }
  } catch (e) {
    return {
      rewayatId: rw.id,
      surahNumber,
      status: 'error',
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (data.length === 0) {
    return {rewayatId: rw.id, surahNumber, status: 'empty'};
  }

  if (!dryRun) {
    await uploadJson(key, data);
  }

  return {rewayatId: rw.id, surahNumber, status: 'uploaded', ayahCount: data.length};
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({length: concurrency}, () => next()));
  return results;
}

async function main() {
  const rewayat = await fetchAllRewayat();
  const eligible = rewayat.filter(rw => {
    if (filterRewayatId) return rw.id === filterRewayatId;
    return rw.mp3quran_read_id != null || rw.qdc_reciter_id != null;
  });
  console.log(`Mirroring timestamps for ${eligible.length} rewayat (dryRun=${dryRun}, skipExisting=${skipExisting})`);

  const allResults: SurahResult[] = [];

  for (const rw of eligible) {
    const surahs = Array.from({length: 114}, (_, i) => i + 1);
    process.stdout.write(`\n[${rw.reciter_name} / ${rw.rewayat_name} / ${rw.style}] (id=${rw.id}) `);
    const results = await runWithConcurrency(
      surahs,
      surah => mirrorSurah(rw, surah),
      CONCURRENCY,
    );
    const uploaded = results.filter(r => r.status === 'uploaded').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const empty = results.filter(r => r.status === 'empty').length;
    const errored = results.filter(r => r.status === 'error').length;
    process.stdout.write(`uploaded=${uploaded} skipped=${skipped} empty=${empty} error=${errored}`);
    if (errored > 0) {
      const sampleErrors = results.filter(r => r.status === 'error').slice(0, 3);
      process.stdout.write(`\n  first errors: ${sampleErrors.map(r => `s${r.surahNumber}:${r.message}`).join(' | ')}`);
    }
    allResults.push(...results);
  }

  // Build per-rewayat coverage report
  const coverage = new Map<string, number[]>();
  for (const r of allResults) {
    if (r.status === 'uploaded' || r.status === 'skipped') {
      const list = coverage.get(r.rewayatId) ?? [];
      list.push(r.surahNumber);
      coverage.set(r.rewayatId, list);
    }
  }
  const coverageObj: Record<string, number[]> = {};
  for (const [id, surahs] of coverage) {
    coverageObj[id] = surahs.sort((a, b) => a - b);
  }

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({coverage: coverageObj, results: allResults}, null, 2),
  );

  console.log(`\n\nReport written to ${REPORT_PATH}`);
  console.log(`Rewayat with at least one surah mirrored: ${Object.keys(coverageObj).length}`);
  const totalUploaded = allResults.filter(r => r.status === 'uploaded').length;
  console.log(`Total surah JSONs uploaded: ${totalUploaded}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
