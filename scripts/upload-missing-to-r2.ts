/**
 * upload-missing-to-r2.ts
 *
 * Sends migration tasks to the Cloudflare R2 Migrator Worker for any rewayat
 * not yet on R2. The Worker fetches from source (mp3quran / quranicaudio) and
 * writes directly to R2 server-side — no local download/upload needed.
 *
 * Usage:
 *   npx tsx scripts/upload-missing-to-r2.ts [--dry-run]
 *
 * Required env vars:
 *   WORKER_URL  — R2 migrator worker URL
 *   AUTH_TOKEN  — Worker auth token
 *   BAYAAN_API_KEY — Bearer token for the backend API
 *
 * Or: reads from .env.r2-worker automatically if present.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlugMappings {
  rewayat: Record<string, string>;
  styles: Record<string, string>;
  _comment?: string;
}

interface RewayatEntry {
  id: string;
  reciter_id: string;
  name: string;
  style: string;
  server: string;
  surah_total: number;
  surah_list: (number | null)[] | null;
  source_type: string;
}

interface ReciterEntry {
  id: string;
  name: string;
  slug: string | null;
  rewayat: RewayatEntry[];
}

interface PaginatedResponse {
  data: ReciterEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

interface MigrateFile {
  source_url: string;
  r2_key: string;
}

interface MigrateResult {
  r2_key: string;
  success: boolean;
  size?: number;
  error?: string;
}

interface MigrateResponse {
  succeeded: number;
  failed: number;
  total: number;
  results: MigrateResult[];
}

interface UploadStats {
  rewayatProcessed: number;
  rewayatSkipped: number;
  rewayatFailed: number;
  surahsSent: number;
  surahsSucceeded: number;
  surahsFailed: number;
  failedFiles: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, '../.env.r2-worker');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const WORKER_URL = process.env.WORKER_URL;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const BAYAAN_API_KEY = process.env.BAYAAN_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');
const STATUS_ONLY = process.argv.includes('--status');
const RESET_STATUS = process.argv.includes('--reset-status');
const CDN_BASE = 'https://cdn.example.com';
const R2_KEY_PREFIX = 'quran/recitations';
const API_BASE = 'https://bayaan-backend-production.up.railway.app';
const PAGE_LIMIT = 200;
const ENQUEUE_BATCH_SIZE = 500; // Worker chunks to 100 internally

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const missing: string[] = [];
  if (!WORKER_URL) missing.push('WORKER_URL');
  if (!AUTH_TOKEN) missing.push('AUTH_TOKEN');
  if (!BAYAAN_API_KEY) missing.push('BAYAAN_API_KEY');

  if (missing.length > 0) {
    console.error(
      `[ERROR] Missing required env vars: ${missing.join(', ')}\n` +
        'Set them directly or create .env.r2-worker with WORKER_URL and AUTH_TOKEN',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchRecitersPage(page: number): Promise<PaginatedResponse> {
  const url = `${API_BASE}/v1/reciters?page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: {Authorization: `Bearer ${BAYAAN_API_KEY}`},
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to fetch reciters page ${page} (${res.status}): ${body}`,
    );
  }

  return res.json() as Promise<PaginatedResponse>;
}

async function fetchAllReciters(): Promise<ReciterEntry[]> {
  console.log('Fetching all reciters...');
  const first = await fetchRecitersPage(1);
  const {total_pages} = first.meta;
  const all: ReciterEntry[] = [...first.data];

  for (let page = 2; page <= total_pages; page++) {
    const resp = await fetchRecitersPage(page);
    all.push(...resp.data);
  }

  console.log(`Fetched ${all.length} reciters total.\n`);
  return all;
}

// ---------------------------------------------------------------------------
// Slug building
// ---------------------------------------------------------------------------

function buildR2KeyBase(
  reciterSlug: string,
  rewayahName: string,
  styleName: string,
  slugMappings: SlugMappings,
): string | null {
  const rewayahSlug = slugMappings.rewayat[rewayahName];
  if (!rewayahSlug) return null;

  const styleSlug =
    slugMappings.styles[styleName] ??
    slugMappings.styles[styleName.toLowerCase()];
  if (!styleSlug) return null;

  return `${R2_KEY_PREFIX}/${reciterSlug}/${rewayahSlug}/${styleSlug}/default`;
}

// ---------------------------------------------------------------------------
// R2 presence check
// ---------------------------------------------------------------------------

async function isOnR2(r2KeyBase: string, firstSurah: number): Promise<boolean> {
  const padded = firstSurah.toString().padStart(3, '0');
  const url = `${CDN_BASE}/${r2KeyBase}/${padded}.mp3`;
  try {
    const res = await fetch(url, {method: 'HEAD'});
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Worker API
// ---------------------------------------------------------------------------

async function enqueueBatch(files: MigrateFile[]): Promise<number> {
  const res = await fetch(`${WORKER_URL}/enqueue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({files}),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Worker /enqueue failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {enqueued: number};
  return json.enqueued;
}

async function checkStatus(): Promise<void> {
  const res = await fetch(`${WORKER_URL}/status`, {
    headers: {Authorization: `Bearer ${AUTH_TOKEN}`},
  });

  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

  const data = (await res.json()) as {
    enqueued: number;
    processed: number;
    succeeded: number;
    failed: number;
    remaining: number;
    percent_done: number;
  };

  console.log('=== Migration Queue Status ===');
  console.log(`  Enqueued:    ${data.enqueued}`);
  console.log(`  Processed:   ${data.processed}`);
  console.log(`  Succeeded:   ${data.succeeded}`);
  console.log(`  Failed:      ${data.failed}`);
  console.log(`  Remaining:   ${data.remaining}`);
  console.log(`  Progress:    ${data.percent_done}%`);
}

async function resetStatus(): Promise<void> {
  const res = await fetch(`${WORKER_URL}/status/reset`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${AUTH_TOKEN}`},
  });

  if (!res.ok) throw new Error(`Status reset failed: ${res.status}`);
  console.log('Status counters reset.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  validateEnv();

  if (STATUS_ONLY) {
    await checkStatus();
    return;
  }

  if (RESET_STATUS) {
    await resetStatus();
    return;
  }

  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be enqueued ===\n');
  }

  // Health check
  try {
    const healthRes = await fetch(`${WORKER_URL}/health`, {
      headers: {Authorization: `Bearer ${AUTH_TOKEN}`},
    });
    if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`);
    console.log('Worker health check: OK\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Worker health check failed: ${msg}`);
    console.error(`URL: ${WORKER_URL}/health`);
    process.exit(1);
  }

  const slugsPath = path.resolve(__dirname, '../data/rewayat-slugs.json');
  const slugMappings: SlugMappings = JSON.parse(
    fs.readFileSync(slugsPath, 'utf8'),
  );

  const reciters = await fetchAllReciters();

  const stats: UploadStats = {
    rewayatProcessed: 0,
    rewayatSkipped: 0,
    rewayatFailed: 0,
    surahsSent: 0,
    surahsSucceeded: 0,
    surahsFailed: 0,
    failedFiles: [],
  };

  for (const reciter of reciters) {
    if (!reciter.rewayat || reciter.rewayat.length === 0) continue;

    for (const rewayat of reciter.rewayat) {
      const prefix = `[${reciter.name} / ${rewayat.name} (${rewayat.style})]`;

      if (rewayat.server?.includes('cdn.example.com')) {
        stats.rewayatSkipped++;
        continue;
      }

      if (!reciter.slug) {
        stats.rewayatSkipped++;
        continue;
      }

      const r2KeyBase = buildR2KeyBase(
        reciter.slug,
        rewayat.name,
        rewayat.style,
        slugMappings,
      );

      if (!r2KeyBase) {
        console.warn(
          `${prefix} Unmapped rewayah/style: "${rewayat.name}" / "${rewayat.style}" — skipping`,
        );
        stats.rewayatFailed++;
        continue;
      }

      const rawSurahList = rewayat.surah_list ?? [];
      const surahNumbers: number[] = rawSurahList.filter(
        (n): n is number => n !== null && typeof n === 'number',
      );

      if (surahNumbers.length === 0) {
        console.warn(`${prefix} No valid surah numbers — skipping`);
        stats.rewayatFailed++;
        continue;
      }

      const alreadyPresent = await isOnR2(r2KeyBase, surahNumbers[0]);
      if (alreadyPresent) {
        stats.rewayatSkipped++;
        continue;
      }

      const sourceServer = rewayat.server?.replace(/\/$/, '');
      if (!sourceServer) {
        console.warn(`${prefix} No source server URL — skipping`);
        stats.rewayatFailed++;
        continue;
      }

      stats.rewayatProcessed++;

      // Build file list for this rewayat
      const files: MigrateFile[] = surahNumbers.map(surahNum => {
        const fileName = surahNum.toString().padStart(3, '0') + '.mp3';
        return {
          source_url: `${sourceServer}/${fileName}`,
          r2_key: `${r2KeyBase}/${fileName}`,
        };
      });

      console.log(
        `${prefix} ${files.length} surahs to enqueue from ${sourceServer}`,
      );

      stats.surahsSent += files.length;

      if (DRY_RUN) {
        continue;
      }

      // Enqueue in batches (worker chunks to 100 internally)
      for (let i = 0; i < files.length; i += ENQUEUE_BATCH_SIZE) {
        const batch = files.slice(i, i + ENQUEUE_BATCH_SIZE);
        try {
          const enqueued = await enqueueBatch(batch);
          stats.surahsSucceeded += enqueued;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ${prefix} Enqueue error: ${msg}`);
          stats.surahsFailed += batch.length;
        }
      }
    }
  }

  // Summary
  console.log('\n=== Enqueue Summary ===');
  if (DRY_RUN) console.log('(DRY RUN — nothing was enqueued)');
  console.log(`  Rewayat processed:   ${stats.rewayatProcessed}`);
  console.log(`  Rewayat skipped:     ${stats.rewayatSkipped}`);
  console.log(`  Rewayat failed:      ${stats.rewayatFailed}`);
  console.log(`  Surahs total:        ${stats.surahsSent}`);
  console.log(`  Surahs enqueued:     ${stats.surahsSucceeded}`);
  console.log(`  Surahs failed:       ${stats.surahsFailed}`);

  if (!DRY_RUN && stats.surahsSucceeded > 0) {
    console.log('\nThe Worker is now processing the queue in the background.');
    console.log(
      'Check progress with: npx tsx scripts/upload-missing-to-r2.ts --status',
    );
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
