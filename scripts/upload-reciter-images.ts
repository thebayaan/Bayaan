/**
 * upload-reciter-images.ts
 *
 * Uploads reciter portrait images from assets/reciter-images/ to Cloudflare R2
 * and updates each reciter's image_url in the backend database.
 *
 * Usage:
 *   npx tsx scripts/upload-reciter-images.ts [--dry-run]
 *
 * Required env (read from .env.r2 + .env automatically):
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 S3-compat access key
 *   R2_SECRET_ACCESS_KEY — R2 S3-compat secret key
 *
 *   BAYAAN_API_KEY       — Bearer token for the backend API
 *   ADMIN_EMAIL          — Admin account email (for JWT)
 *   ADMIN_PASSWORD       — Admin account password (for JWT)
 *
 * Optional env (falls back to defaults):
 *   BAYAAN_API_URL       — Backend base URL (default: production Railway URL)
 *
 * Behaviour:
 *   - Parses utils/reciterImages.ts to build slug → filename mapping
 *   - Fetches all reciters from the API to get slug → id mapping
 *   - Skips images already present on CDN (HEAD check)
 *   - Uploads to R2 key: assets/reciter-images/{slug}.{ext}
 *   - Sets Cache-Control: public, max-age=31536000, immutable
 *   - Updates DB via PUT /admin/reciters/:id with the new CDN URL
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReciterEntry {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
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
  uploaded: number;
  skipped: number;
  failed: number;
  dbUpdated: number;
  dbFailed: number;
  noSlugMatch: number;
}

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
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

const ROOT = path.resolve(__dirname, '..');

loadEnvFile(path.join(ROOT, '.env.r2'));
loadEnvFile(path.join(ROOT, '.env'));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const BAYAAN_API_KEY =
  process.env.BAYAAN_API_KEY ?? process.env.EXPO_PUBLIC_BAYAAN_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const API_URL =
  process.env.BAYAAN_API_URL ??
  process.env.EXPO_PUBLIC_BAYAAN_API_URL ??
  'https://bayaan-backend-production.up.railway.app';

const DRY_RUN = process.argv.includes('--dry-run');

const R2_BUCKET = 'bayaan-audio';
const CDN_BASE = 'https://cdn.example.com';
const R2_KEY_PREFIX = 'assets/reciter-images';
const PAGE_LIMIT = 200;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!BAYAAN_API_KEY)
    missing.push('BAYAAN_API_KEY / EXPO_PUBLIC_BAYAAN_API_KEY');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    console.error(
      `[ERROR] Missing required env vars:\n  ${missing.join('\n  ')}\n`,
    );
    console.error(
      'Set them in .env.r2 (R2 credentials) and .env (API credentials).',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// R2 client
// ---------------------------------------------------------------------------

function buildS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

// ---------------------------------------------------------------------------
// Parse reciterImages.ts → Map<slug, filename>
// ---------------------------------------------------------------------------

function parseReciterImagesMap(): Map<string, string> {
  const filePath = path.join(ROOT, 'utils', 'reciterImages.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const map = new Map<string, string>();

  // Match: 'slug-name': require('@/assets/reciter-images/Filename.ext'),
  const re = /'([^']+)':\s*require\('@\/assets\/reciter-images\/([^']+)'\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const slug = match[1];
    const filename = match[2];
    map.set(slug, filename);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------

let jwtToken: string | null = null;

async function authenticate(): Promise<string> {
  console.log('Authenticating with admin API...');
  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Authentication failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {data: {token: string}};
  if (!json.data?.token) {
    throw new Error('Authentication response missing token');
  }

  jwtToken = json.data.token;
  console.log('Authenticated successfully.\n');
  return jwtToken;
}

async function getToken(): Promise<string> {
  if (!jwtToken) {
    return authenticate();
  }
  return jwtToken;
}

// ---------------------------------------------------------------------------
// Fetch all reciters
// ---------------------------------------------------------------------------

async function fetchRecitersPage(page: number): Promise<PaginatedResponse> {
  const url = `${API_URL}/v1/reciters?page=${page}&limit=${PAGE_LIMIT}`;
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
  console.log('Fetching all reciters from API...');
  const first = await fetchRecitersPage(1);
  const {total_pages, total} = first.meta;
  const all: ReciterEntry[] = [...first.data];

  console.log(`  Page 1/${total_pages} — ${first.data.length} reciters`);

  for (let page = 2; page <= total_pages; page++) {
    const resp = await fetchRecitersPage(page);
    all.push(...resp.data);
    console.log(`  Page ${page}/${total_pages} — ${resp.data.length} reciters`);
  }

  console.log(`Fetched ${all.length} / ${total} reciters total.\n`);
  return all;
}

// ---------------------------------------------------------------------------
// R2 existence check (via CDN HEAD)
// ---------------------------------------------------------------------------

async function existsOnCdn(cdnUrl: string): Promise<boolean> {
  try {
    const res = await fetch(cdnUrl, {method: 'HEAD'});
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// R2 existence check (via S3 HeadObject — authoritative)
// ---------------------------------------------------------------------------

async function existsInR2(s3: S3Client, r2Key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({Bucket: R2_BUCKET, Key: r2Key}));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Upload single image to R2
// ---------------------------------------------------------------------------

async function uploadImage(
  s3: S3Client,
  localPath: string,
  r2Key: string,
  ext: string,
): Promise<void> {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: body,
      ContentType: mimeForExt(ext),
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

// ---------------------------------------------------------------------------
// Update reciter image_url in DB
// ---------------------------------------------------------------------------

async function updateReciterImageUrl(
  reciterId: string,
  imageUrl: string,
  retried = false,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/admin/reciters/${reciterId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({image_url: imageUrl}),
  });

  if (res.status === 401 && !retried) {
    console.log('  JWT expired — re-authenticating...');
    jwtToken = null;
    await authenticate();
    return updateReciterImageUrl(reciterId, imageUrl, true);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PUT /admin/reciters/${reciterId} failed (${res.status}): ${body}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  validateEnv();

  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be uploaded or DB updated ===\n');
  }

  // Parse slug → filename map from reciterImages.ts
  const slugToFilename = parseReciterImagesMap();
  console.log(
    `Parsed ${slugToFilename.size} slug → filename entries from reciterImages.ts\n`,
  );

  // Fetch all reciters from API
  await authenticate();
  const reciters = await fetchAllReciters();

  // Build slug → reciter lookup
  const slugToReciter = new Map<string, ReciterEntry>();
  for (const reciter of reciters) {
    if (reciter.slug) {
      slugToReciter.set(reciter.slug, reciter);
    }
  }

  const s3 = buildS3Client();
  const imagesDir = path.join(ROOT, 'assets', 'reciter-images');

  const stats: UploadStats = {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    dbUpdated: 0,
    dbFailed: 0,
    noSlugMatch: 0,
  };

  const slugsSorted = [...slugToFilename.keys()].sort();

  for (const slug of slugsSorted) {
    const filename = slugToFilename.get(slug)!;
    const localPath = path.join(imagesDir, filename);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const r2Key = `${R2_KEY_PREFIX}/${slug}.${ext}`;
    const cdnUrl = `${CDN_BASE}/${r2Key}`;

    const prefix = `[${slug}]`;

    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      console.warn(`${prefix} Local file not found: ${filename} — skipping`);
      stats.failed++;
      continue;
    }

    // Check existence in R2 (authoritative S3 HEAD)
    const alreadyExists = await existsInR2(s3, r2Key);
    if (alreadyExists) {
      console.log(`${prefix} Already in R2 — skipping upload`);
      stats.skipped++;
    } else {
      console.log(`${prefix} Uploading ${filename} → ${r2Key}`);
      if (!DRY_RUN) {
        try {
          await uploadImage(s3, localPath, r2Key, ext);
          stats.uploaded++;
          console.log(`${prefix} Uploaded OK`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`${prefix} Upload failed: ${msg}`);
          stats.failed++;
          continue;
        }
      } else {
        stats.uploaded++;
      }
    }

    // Update DB image_url
    const reciter = slugToReciter.get(slug);
    if (!reciter) {
      console.warn(`${prefix} No matching reciter in DB — skipping DB update`);
      stats.noSlugMatch++;
      continue;
    }

    if (reciter.image_url === cdnUrl) {
      console.log(`${prefix} DB image_url already up to date`);
      continue;
    }

    console.log(`${prefix} Updating DB image_url → ${cdnUrl}`);
    if (!DRY_RUN) {
      try {
        await updateReciterImageUrl(reciter.id, cdnUrl);
        stats.dbUpdated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${prefix} DB update failed: ${msg}`);
        stats.dbFailed++;
      }
    } else {
      stats.dbUpdated++;
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== Upload Summary ===');
  if (DRY_RUN) console.log('(DRY RUN — no changes were made)');
  console.log(`  Images uploaded:      ${stats.uploaded}`);
  console.log(`  Images skipped:       ${stats.skipped}`);
  console.log(`  Images failed:        ${stats.failed}`);
  console.log(`  DB records updated:   ${stats.dbUpdated}`);
  console.log(`  DB updates failed:    ${stats.dbFailed}`);
  console.log(`  No DB match (slug):   ${stats.noSlugMatch}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
