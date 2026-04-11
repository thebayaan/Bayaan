/**
 * upload-missing-to-r2.ts
 *
 * Downloads audio files from source servers (mp3quran.net / quranicaudio.com)
 * and uploads them to the Cloudflare R2 bucket for any rewayat not yet on R2.
 *
 * Usage:
 *   npx tsx scripts/upload-missing-to-r2.ts [--dry-run]
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   BAYAAN_API_KEY       — Bearer token for the backend API
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Minimal local types that mirror the @aws-sdk/client-s3 surface we use.
// Using these avoids a compile-time hard dependency — the runtime check below
// provides a helpful error if the package is not installed.
// ---------------------------------------------------------------------------
interface S3ClientConfig {
  region: string;
  endpoint: string;
  credentials: {accessKeyId: string; secretAccessKey: string};
}

interface PutObjectInput {
  Bucket: string;
  Key: string;
  Body: Buffer;
  ContentType: string;
  CacheControl: string;
}

interface S3ClientInstance {
  send(cmd: unknown): Promise<unknown>;
}

interface S3Sdk {
  S3Client: new (config: S3ClientConfig) => S3ClientInstance;
  PutObjectCommand: new (input: PutObjectInput) => unknown;
}

// ---------------------------------------------------------------------------
// Dependency check — print helpful instructions if @aws-sdk/client-s3 is missing
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const awsSdk = ((): S3Sdk => {
  try {
    return require('@aws-sdk/client-s3') as S3Sdk;
  } catch {
    console.error(
      '\n[ERROR] @aws-sdk/client-s3 is not installed.\n' +
        'Run one of the following to install it:\n\n' +
        '  npm install @aws-sdk/client-s3\n' +
        '  # or\n' +
        '  yarn add @aws-sdk/client-s3\n',
    );
    process.exit(1);
  }
})();

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

interface UploadStats {
  rewayatProcessed: number;
  rewayatSkipped: number;
  rewayatFailed: number;
  surahsUploaded: number;
  surahsFailed: number;
  surahsSkipped: number;
}

// ---------------------------------------------------------------------------
// Config / env
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BAYAAN_API_KEY = process.env.BAYAAN_API_KEY;

const DRY_RUN = process.argv.includes('--dry-run');
const R2_BUCKET = 'bayaan-audio';
const CDN_BASE = 'https://cdn.thebayaan.com';
const R2_KEY_PREFIX = 'quran/recitations';
const API_BASE = 'https://bayaan-backend-production.up.railway.app';
const PAGE_LIMIT = 200;
const MAX_CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!BAYAAN_API_KEY) missing.push('BAYAAN_API_KEY');

  if (missing.length > 0) {
    console.error(
      `[ERROR] Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// R2 client (lazy — not constructed in dry-run)
// ---------------------------------------------------------------------------

function createS3Client(): S3ClientInstance {
  return new awsSdk.S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
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

  console.log(
    `  Page 1/${total_pages} — ${first.data.length} reciters (total: ${first.meta.total})`,
  );

  for (let page = 2; page <= total_pages; page++) {
    const resp = await fetchRecitersPage(page);
    all.push(...resp.data);
    console.log(`  Page ${page}/${total_pages} — ${resp.data.length} reciters`);
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

function surahFileName(surahNumber: number): string {
  return surahNumber.toString().padStart(3, '0') + '.mp3';
}

// ---------------------------------------------------------------------------
// R2 presence check
// ---------------------------------------------------------------------------

async function isOnR2(r2KeyBase: string): Promise<boolean> {
  const url = `${CDN_BASE}/${r2KeyBase}/001.mp3`;
  try {
    const res = await fetch(url, {method: 'HEAD'});
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Download + upload
// ---------------------------------------------------------------------------

async function downloadToTemp(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null; // expected — log at call site
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const tempPath = path.join(
    os.tmpdir(),
    `bayaan-r2-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  );
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
  return tempPath;
}

async function uploadToR2(
  s3: S3ClientInstance,
  r2Key: string,
  filePath: string,
): Promise<void> {
  const fileBody = fs.readFileSync(filePath);
  const cmd = new awsSdk.PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileBody,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  });
  await s3.send(cmd);
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const taskIndex = index++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  const workers = Array.from(
    {length: Math.min(concurrency, tasks.length)},
    worker,
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Process a single rewayat
// ---------------------------------------------------------------------------

interface SurahResult {
  surah: number;
  status: 'uploaded' | 'skipped' | 'failed';
  reason?: string;
}

async function processSurah(
  s3: S3ClientInstance | null,
  r2KeyBase: string,
  sourceServer: string,
  surahNumber: number,
  prefix: string,
): Promise<SurahResult> {
  const fileName = surahFileName(surahNumber);
  const sourceUrl = `${sourceServer}/${fileName}`;
  const r2Key = `${r2KeyBase}/${fileName}`;

  if (DRY_RUN) {
    console.log(
      `  [DRY-RUN] Would upload surah ${surahNumber}: ${sourceUrl} → ${r2Key}`,
    );
    return {surah: surahNumber, status: 'skipped', reason: 'dry-run'};
  }

  let tempPath: string | null = null;
  try {
    tempPath = await downloadToTemp(sourceUrl);
    if (tempPath === null) {
      console.warn(
        `  ${prefix} Surah ${surahNumber}: source 404 — ${sourceUrl}`,
      );
      return {surah: surahNumber, status: 'failed', reason: '404 at source'};
    }

    await uploadToR2(s3!, r2Key, tempPath);
    return {surah: surahNumber, status: 'uploaded'};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ${prefix} Surah ${surahNumber}: error — ${msg}`);
    return {surah: surahNumber, status: 'failed', reason: msg};
  } finally {
    if (tempPath) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  validateEnv();

  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be downloaded or uploaded ===\n');
  }

  const slugsPath = path.resolve(__dirname, '../data/rewayat-slugs.json');
  const slugMappings: SlugMappings = JSON.parse(
    fs.readFileSync(slugsPath, 'utf8'),
  );

  const s3: S3ClientInstance | null = DRY_RUN ? null : createS3Client();

  const reciters = await fetchAllReciters();

  const stats: UploadStats = {
    rewayatProcessed: 0,
    rewayatSkipped: 0,
    rewayatFailed: 0,
    surahsUploaded: 0,
    surahsFailed: 0,
    surahsSkipped: 0,
  };

  for (const reciter of reciters) {
    if (!reciter.rewayat || reciter.rewayat.length === 0) continue;

    for (const rewayat of reciter.rewayat) {
      const prefix = `[${reciter.name} / ${rewayat.name} (${rewayat.style})]`;

      // Skip if already on R2
      if (rewayat.server?.includes('cdn.thebayaan.com')) {
        stats.rewayatSkipped++;
        continue;
      }

      // Skip reciters with no slug
      if (!reciter.slug) {
        console.warn(`${prefix} Reciter has no slug — skipping`);
        stats.rewayatFailed++;
        continue;
      }

      // Build R2 key base
      const r2KeyBase = buildR2KeyBase(
        reciter.slug,
        rewayat.name,
        rewayat.style,
        slugMappings,
      );

      if (!r2KeyBase) {
        console.warn(
          `${prefix} Cannot build R2 path (unmapped rewayah or style: "${rewayat.name}" / "${rewayat.style}") — skipping`,
        );
        stats.rewayatFailed++;
        continue;
      }

      // Check if surah 001 already on R2 (quick presence check)
      console.log(`${prefix} Checking R2 presence...`);
      const alreadyPresent = await isOnR2(r2KeyBase);
      if (alreadyPresent) {
        console.log(`${prefix} Already on R2 (001.mp3 found) — skipping`);
        stats.rewayatSkipped++;
        continue;
      }

      // Build surah list
      const rawSurahList = rewayat.surah_list ?? [];
      const surahNumbers: number[] = rawSurahList.filter(
        (n): n is number => n !== null && typeof n === 'number',
      );

      if (surahNumbers.length === 0) {
        console.warn(`${prefix} No valid surah numbers — skipping`);
        stats.rewayatFailed++;
        continue;
      }

      const sourceServer = rewayat.server?.replace(/\/$/, '');
      if (!sourceServer) {
        console.warn(`${prefix} No source server URL — skipping`);
        stats.rewayatFailed++;
        continue;
      }

      console.log(
        `${prefix} Uploading ${surahNumbers.length} surahs from ${sourceServer}`,
      );

      stats.rewayatProcessed++;

      // Build tasks for concurrent execution
      const tasks = surahNumbers.map(
        surahNumber => () =>
          processSurah(s3, r2KeyBase, sourceServer, surahNumber, prefix),
      );

      const results = await runConcurrent(tasks, MAX_CONCURRENCY);

      let uploaded = 0;
      let failed = 0;
      let skipped = 0;

      for (const result of results) {
        if (result.status === 'uploaded') uploaded++;
        else if (result.status === 'failed') failed++;
        else skipped++;
      }

      stats.surahsUploaded += uploaded;
      stats.surahsFailed += failed;
      stats.surahsSkipped += skipped;

      console.log(
        `${prefix} Done — uploaded: ${uploaded}, failed: ${failed}, skipped: ${skipped}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== Upload Summary ===');
  if (DRY_RUN) console.log('(DRY RUN — no changes were written)');
  console.log(`  Rewayat processed:  ${stats.rewayatProcessed}`);
  console.log(`  Rewayat skipped:    ${stats.rewayatSkipped}`);
  console.log(`  Rewayat failed:     ${stats.rewayatFailed}`);
  console.log(`  Surahs uploaded:    ${stats.surahsUploaded}`);
  console.log(`  Surahs failed:      ${stats.surahsFailed}`);
  console.log(`  Surahs skipped:     ${stats.surahsSkipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
