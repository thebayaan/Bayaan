/**
 * upload-adhkar-audio.ts
 *
 * Uploads adhkar dhikr audio from assets/audio/adhkar/ to Cloudflare R2 so
 * web and other clients can stream the same files the mobile app bundles locally.
 *
 * CDN URLs:
 *   https://cdn.thebayaan.com/adkhar/adhkar_1.mp3
 *   https://cdn.thebayaan.com/adkhar/adhkar_2.mp3
 *
 * Usage:
 *   npx tsx scripts/upload-adhkar-audio.ts [--dry-run] [--verify-only]
 *
 * Auth — use ONE of these in .env.r2:
 *
 *   A) Cloudflare API token (what the dashboard often shows as one token):
 *      R2_ACCOUNT_ID=your_account_id
 *      R2_API_TOKEN=cfat_...            (or put cfat_... in R2_SECRET_ACCESS_KEY)
 *
 *   B) R2 S3-compatible keys (shown together when creating an R2 API token):
 *      R2_ACCOUNT_ID=your_account_id
 *      R2_ACCESS_KEY_ID=...
 *      R2_SECRET_ACCESS_KEY=...         (64-char hex, NOT cfat_...)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

interface UploadStats {
  uploaded: number;
  skipped: number;
  failed: number;
}

type AuthMode = 'api-token' | 's3';

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

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY;
const R2_API_TOKEN =
  process.env.R2_API_TOKEN ??
  process.env.CLOUDFLARE_API_TOKEN ??
  (R2_SECRET_ACCESS_KEY?.startsWith('cfat_') ? R2_SECRET_ACCESS_KEY : undefined);

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify-only');

const R2_BUCKET = 'bayaan-audio';
const CDN_BASE = 'https://cdn.thebayaan.com';
// Isolated prefix — does not touch existing assets/audio/adhkar/ or quran/ paths
const R2_KEY_PREFIX = 'adkhar';
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio', 'adhkar');
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function resolveS3Credentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} | null {
  if (
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    !R2_SECRET_ACCESS_KEY.startsWith('cfat_')
  ) {
    return {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    };
  }

  // cfat_ token value + Access Key ID from R2 token creation screen
  if (R2_ACCESS_KEY_ID && R2_API_TOKEN) {
    return {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: crypto
        .createHash('sha256')
        .update(R2_API_TOKEN)
        .digest('hex'),
    };
  }

  return null;
}

function resolveAuthMode(): AuthMode {
  if (resolveS3Credentials()) {
    return 's3';
  }
  if (R2_API_TOKEN) {
    return 'api-token';
  }
  return 'api-token';
}

function validateEnv(): AuthMode {
  if (!R2_ACCOUNT_ID) {
    console.error('[ERROR] Missing R2_ACCOUNT_ID in .env.r2');
    process.exit(1);
  }

  const mode = resolveAuthMode();

  if (mode === 's3') {
    if (!resolveS3Credentials()) {
      console.error(
        '[ERROR] S3 mode requires R2_ACCESS_KEY_ID plus either:\n' +
          '  R2_SECRET_ACCESS_KEY (64-char hex from R2 token screen), or\n' +
          '  R2_API_TOKEN (cfat_... — script derives the S3 secret via SHA-256)',
      );
      process.exit(1);
    }
  } else if (!R2_API_TOKEN) {
    console.error(
      '[ERROR] Missing credentials. Set either:\n' +
        '  R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY\n' +
        '  R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_API_TOKEN (cfat_...)',
    );
    process.exit(1);
  }

  return mode;
}

function buildS3Client(): S3Client {
  const creds = resolveS3Credentials()!;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  });
}

function listAudioFiles(): string[] {
  if (!fs.existsSync(AUDIO_DIR)) {
    throw new Error(`Audio directory not found: ${AUDIO_DIR}`);
  }

  return fs
    .readdirSync(AUDIO_DIR)
    .filter(name => name.endsWith('.mp3'))
    .sort((a, b) => {
      const numA = Number.parseInt(a.replace(/\D/g, ''), 10);
      const numB = Number.parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });
}

function cdnUrlFor(filename: string): string {
  return `${CDN_BASE}/${R2_KEY_PREFIX}/${filename}`;
}

function r2KeyFor(filename: string): string {
  return `${R2_KEY_PREFIX}/${filename}`;
}

function apiUploadUrl(r2Key: string): string {
  const encodedKey = r2Key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodedKey}`;
}

async function existsOnCdn(filename: string): Promise<boolean> {
  try {
    const res = await fetch(cdnUrlFor(filename), {method: 'HEAD'});
    return res.ok;
  } catch {
    return false;
  }
}

async function existsInR2S3(s3: S3Client, r2Key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({Bucket: R2_BUCKET, Key: r2Key}));
    return true;
  } catch {
    return false;
  }
}

async function uploadViaS3(
  s3: S3Client,
  localPath: string,
  r2Key: string,
): Promise<void> {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: body,
      ContentType: 'audio/mpeg',
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function uploadViaApiToken(
  localPath: string,
  r2Key: string,
): Promise<void> {
  const body = fs.readFileSync(localPath);
  const res = await fetch(apiUploadUrl(r2Key), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${R2_API_TOKEN}`,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': CACHE_CONTROL,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function verifySample(filenames: string[]): Promise<void> {
  const sample = [
    filenames[0],
    filenames[Math.floor(filenames.length / 2)],
    filenames[filenames.length - 1],
  ].filter(Boolean);

  console.log('\nVerifying CDN availability (sample)...');
  for (const filename of sample) {
    const ok = await existsOnCdn(filename);
    console.log(`  ${ok ? 'OK' : 'FAIL'} ${cdnUrlFor(filename)}`);
  }
}

async function main(): Promise<void> {
  const authMode = validateEnv();
  console.log(`Auth mode: ${authMode}`);
  console.log(`Target bucket: ${R2_BUCKET}`);
  console.log(`Target prefix: ${R2_KEY_PREFIX}/ (never overwrites existing objects)\n`);

  const filenames = listAudioFiles();
  console.log(`Found ${filenames.length} adhkar audio files.\n`);

  if (VERIFY_ONLY) {
    let ok = 0;
    let fail = 0;
    for (const filename of filenames) {
      const exists = await existsOnCdn(filename);
      if (exists) ok++;
      else {
        fail++;
        console.log(`MISSING ${cdnUrlFor(filename)}`);
      }
    }
    console.log(`\nCDN verify: ${ok} ok, ${fail} missing`);
    process.exit(fail > 0 ? 1 : 0);
  }

  if (DRY_RUN) {
    console.log('=== DRY RUN — no files will be uploaded ===\n');
  }

  const s3 = authMode === 's3' ? buildS3Client() : null;
  const stats: UploadStats = {uploaded: 0, skipped: 0, failed: 0};

  for (const filename of filenames) {
    const localPath = path.join(AUDIO_DIR, filename);
    const r2Key = r2KeyFor(filename);
    const prefix = `[${filename}]`;

    const alreadyExists = s3
      ? await existsInR2S3(s3, r2Key)
      : await existsOnCdn(filename);

    if (alreadyExists) {
      console.log(`${prefix} Already exists at ${r2Key} — skipping (no overwrite)`);
      stats.skipped++;
      continue;
    }

    console.log(`${prefix} Uploading → ${r2Key}`);
    if (DRY_RUN) {
      stats.uploaded++;
      continue;
    }

    try {
      if (authMode === 's3' && s3) {
        await uploadViaS3(s3, localPath, r2Key);
      } else {
        await uploadViaApiToken(localPath, r2Key);
      }
      stats.uploaded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${prefix} Upload failed: ${msg}`);
      stats.failed++;

      // Stop early on auth errors
      if (msg.includes('401') || msg.includes('403')) {
        console.error('\nAuth failed — check token permissions (R2 Object Write).');
        process.exit(1);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Uploaded: ${stats.uploaded}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log(`Failed:   ${stats.failed}`);

  if (!DRY_RUN && stats.failed === 0 && stats.uploaded > 0) {
    await verifySample(filenames);
  }

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
