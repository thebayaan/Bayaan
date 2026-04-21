/**
 * Fetches all reciters from the Bayaan backend API and saves them
 * to data/reciters-fallback.json for use as a killswitch fallback.
 *
 * Usage: npx tsx scripts/generate-fallback-reciters.ts
 *
 * ⚠️  MAINTAINER-ONLY — this overwrites the OSS-safe fallback.
 *
 * The file checked into git at data/reciters-fallback.json is a curated
 * public-source version (mp3quran.net / quranicaudio.com only) that ships
 * with the open-source repo so forks work out of the box without exposing
 * the full R2 catalog. Running this script replaces it with the full
 * catalog from the Bayaan API (including cdn.example.com URLs).
 *
 * Do not commit the regenerated file to the public repo. If you need to
 * regenerate the OSS fallback after adding new reciters, export the data
 * and filter out entries whose `server` points at private hosts before
 * committing.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Rewayat {
  id: string;
  reciter_id: string;
  name: string;
  style: string;
  server: string;
  surah_total: number;
  surah_list: (number | null)[];
  source_type: string;
  created_at: string;
  mp3quran_read_id?: number;
  qdc_reciter_id?: number;
}

interface Reciter {
  id: string;
  name: string;
  slug?: string | null;
  date: string | null;
  image_url: string | null;
  rewayat: Rewayat[];
}

interface PaginatedResponse {
  data: Reciter[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ---------------------------------------------------------------------------
// Env parsing
// ---------------------------------------------------------------------------

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const envPath = path.resolve(__dirname, '..', '.env');
  const env = loadEnv(envPath);

  const apiUrl = env['EXPO_PUBLIC_BAYAAN_API_URL'];
  const apiKey = env['EXPO_PUBLIC_BAYAAN_API_KEY'];

  if (!apiUrl || !apiKey) {
    console.error(
      'Missing EXPO_PUBLIC_BAYAAN_API_URL or EXPO_PUBLIC_BAYAAN_API_KEY in .env',
    );
    process.exit(1);
  }

  console.log(`Fetching reciters from ${apiUrl}...`);

  const PAGE_SIZE = 200;
  let page = 1;
  let allReciters: Reciter[] = [];

  while (true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const res = await fetch(
      `${apiUrl}/v1/reciters?page=${page}&limit=${PAGE_SIZE}`,
      {headers},
    );

    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const json: PaginatedResponse = await res.json();
    const reciters: Reciter[] = (json.data ?? []).map(r => ({
      ...r,
      rewayat: (r.rewayat ?? []).map(rw => ({
        ...rw,
        surah_list: rw.surah_list ?? [],
      })),
    }));

    allReciters = allReciters.concat(reciters);

    const {total_pages} = json.meta ?? {};
    if (!total_pages || page >= total_pages) break;
    page++;
  }

  console.log(`Fetched ${allReciters.length} reciters across ${page} page(s).`);

  const outPath = path.resolve(
    __dirname,
    '..',
    'data',
    'reciters-fallback.json',
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify(allReciters, null, 2) + '\n',
    'utf-8',
  );

  console.log(`Saved fallback data to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
