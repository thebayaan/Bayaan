/**
 * extend-rewayat.ts
 *
 * Fills gaps in rewayat that are already on R2 (surahs mp3quran has added
 * since the mirror) and adds whole extra recordings that would collide with
 * an existing R2 folder (e.g. a second murattal for the same reciter).
 * upload-missing-to-r2 can't do either: it only checks a rewayah's first
 * surah, and it always writes to `.../<style>/default`.
 *
 * Two phases, run in order:
 *
 *   npx tsx scripts/extend-rewayat.ts --enqueue [--dry-run]
 *     For each entry, HEADs every mp3quran surah on the CDN and sends the
 *     missing ones to the R2 migrator Worker.
 *
 *   npx tsx scripts/extend-rewayat.ts --apply [--dry-run]
 *     Once the Worker has finished (check with upload-missing-to-r2 --status),
 *     re-checks the CDN and, only for entries whose files are all present,
 *     updates the database: merges the new surahs into an existing rewayah's
 *     surah_list, or creates the new rewayah pointing at its R2 folder.
 *
 * Required env (.env.r2-worker is read automatically if present):
 *   WORKER_URL, AUTH_TOKEN          — R2 migrator Worker (--enqueue)
 *   CDN_BASE                        — public base URL of the audio bucket
 *   BAYAAN_API_URL, BAYAAN_API_KEY  — backend + key for GET /v1/reciters (--apply)
 *   ADMIN_EMAIL, ADMIN_PASSWORD     — admin login for writes (--apply)
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// What to extend
// ---------------------------------------------------------------------------

interface Extension {
  reciterSlug: string;
  /** Rewayah name and style as stored in the database. */
  rewayahName: string;
  style: string;
  /** R2 key prefix the surah files live under (no trailing slash). */
  r2Folder: string;
  /** mp3quran v3 moshaf id to mirror from. */
  mp3quranMoshafId: number;
  /** True when this is a new rewayah rather than a top-up of an existing one. */
  newRewayah?: boolean;
}

const HAFS = "Hafs A'n Assem";
const WARSH = "Warsh A'n Nafi'";
const folder = (
  slug: string,
  rewayah: string,
  style: string,
  variant = 'default',
) => `quran/recitations/${slug}/${rewayah}/${style}/${variant}`;

const EXTENSIONS: Extension[] = [
  // Top-ups: mp3quran has surahs our mirror predates.
  {
    reciterSlug: 'omar-al-darweez',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('omar-al-darweez', 'hafs', 'murattal'),
    mp3quranMoshafId: 260,
  },
  {
    reciterSlug: 'hazza-al-balushi',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('hazza-al-balushi', 'hafs', 'murattal'),
    mp3quranMoshafId: 231,
  },
  {
    reciterSlug: 'abdulrahman-alsuwayid',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('abdulrahman-alsuwayid', 'hafs', 'murattal'),
    mp3quranMoshafId: 135,
  },
  {
    reciterSlug: 'islam-sobhi',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('islam-sobhi', 'hafs', 'murattal'),
    mp3quranMoshafId: 253,
  },
  {
    reciterSlug: 'hamad-al-daghriri',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('hamad-al-daghriri', 'hafs', 'murattal'),
    mp3quranMoshafId: 19,
  },
  {
    reciterSlug: 'abdullah-al-burimi',
    rewayahName: HAFS,
    style: 'murattal',
    r2Folder: folder('abdullah-al-burimi', 'hafs', 'murattal'),
    mp3quranMoshafId: 57,
  },
  {
    reciterSlug: 'abdelaziz-sheim',
    rewayahName: WARSH,
    style: 'murattal',
    r2Folder: folder('abdelaziz-sheim', 'warsh', 'murattal'),
    mp3quranMoshafId: 319,
  },
  {
    reciterSlug: 'omar-al-qazabri',
    rewayahName: WARSH,
    style: 'murattal',
    r2Folder: folder('omar-al-qazabri', 'warsh', 'murattal'),
    mp3quranMoshafId: 80,
  },
  // Minshawi's 1967 recording. Its own folder, since murattal/default is
  // already his standard murattal (same pattern as mohammed-ayyub's alt-1).
  {
    reciterSlug: 'mohammed-siddiq-al-minshawi',
    rewayahName: HAFS,
    style: 'murattal 1967',
    r2Folder: folder(
      'mohammed-siddiq-al-minshawi',
      'hafs',
      'murattal',
      'alt-1',
    ),
    mp3quranMoshafId: 10924,
    newRewayah: true,
  },
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, '../.env.r2-worker');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnvFile();

const ENQUEUE = process.argv.includes('--enqueue');
const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run');

const {
  WORKER_URL,
  AUTH_TOKEN,
  BAYAAN_API_URL,
  BAYAAN_API_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} = process.env;
const CDN_BASE = process.env.CDN_BASE?.replace(/\/$/, '');
const MP3QURAN_API = 'https://mp3quran.net/api/v3/reciters?language=eng';
const HEAD_CONCURRENCY = 10;
const ENQUEUE_BATCH_SIZE = 500;

function requireEnv(names: string[]): void {
  const missing = names.filter(n => !process.env[n]);
  if (missing.length > 0) {
    console.error(`[ERROR] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// mp3quran + CDN
// ---------------------------------------------------------------------------

interface Moshaf {
  server: string;
  surahs: number[];
}

async function fetchMoshafs(): Promise<Map<number, Moshaf>> {
  const res = await fetch(MP3QURAN_API);
  if (!res.ok) throw new Error(`mp3quran API ${res.status}`);
  const json = (await res.json()) as {
    reciters: Array<{
      moshaf: Array<{id: number; server: string; surah_list: string}>;
    }>;
  };
  const map = new Map<number, Moshaf>();
  for (const r of json.reciters) {
    for (const m of r.moshaf) {
      map.set(m.id, {
        server: m.server.replace(/\/$/, ''),
        surahs: m.surah_list.split(',').filter(Boolean).map(Number),
      });
    }
  }
  return map;
}

const fileName = (surah: number) => `${surah.toString().padStart(3, '0')}.mp3`;

async function onCdn(r2Folder: string, surah: number): Promise<boolean> {
  try {
    const res = await fetch(`${CDN_BASE}/${r2Folder}/${fileName(surah)}`, {
      method: 'HEAD',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Splits surahs into those already on the CDN and those still missing. */
async function checkCdn(
  r2Folder: string,
  surahs: number[],
): Promise<{present: number[]; missing: number[]}> {
  const present: number[] = [];
  const missing: number[] = [];
  for (let i = 0; i < surahs.length; i += HEAD_CONCURRENCY) {
    const chunk = surahs.slice(i, i + HEAD_CONCURRENCY);
    const results = await Promise.all(chunk.map(s => onCdn(r2Folder, s)));
    chunk.forEach((s, j) => (results[j] ? present : missing).push(s));
  }
  return {present, missing};
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function enqueue(
  files: Array<{source_url: string; r2_key: string}>,
): Promise<number> {
  const res = await fetch(`${WORKER_URL}/enqueue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({files}),
  });
  if (!res.ok)
    throw new Error(
      `Worker /enqueue failed (${res.status}): ${await res.text()}`,
    );
  return ((await res.json()) as {enqueued: number}).enqueued;
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

interface RewayatEntry {
  id: string;
  name: string;
  style: string;
  surah_list: (number | null)[] | null;
}

interface ReciterEntry {
  id: string;
  slug: string | null;
  rewayat: RewayatEntry[];
}

async function fetchAllReciters(): Promise<ReciterEntry[]> {
  const all: ReciterEntry[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${BAYAAN_API_URL}/v1/reciters?page=${page}&limit=200`,
      {
        headers: {Authorization: `Bearer ${BAYAAN_API_KEY}`},
      },
    );
    if (!res.ok)
      throw new Error(`GET /v1/reciters page ${page} failed (${res.status})`);
    const json = (await res.json()) as {
      data: ReciterEntry[];
      meta: {total_pages: number};
    };
    all.push(...json.data);
    if (page >= json.meta.total_pages) return all;
  }
}

let jwtToken: string | null = null;

async function authenticate(): Promise<string> {
  const res = await fetch(`${BAYAAN_API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
  });
  if (!res.ok)
    throw new Error(
      `Authentication failed (${res.status}): ${await res.text()}`,
    );
  const json = (await res.json()) as {data: {token: string}};
  if (!json.data?.token)
    throw new Error('Authentication response missing token');
  jwtToken = json.data.token;
  return jwtToken;
}

async function adminRequest(
  method: 'PUT' | 'POST',
  urlPath: string,
  body: unknown,
  retried = false,
): Promise<unknown> {
  const token = jwtToken ?? (await authenticate());
  const res = await fetch(`${BAYAAN_API_URL}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && !retried) {
    jwtToken = null;
    return adminRequest(method, urlPath, body, true);
  }
  if (!res.ok)
    throw new Error(
      `${method} ${urlPath} failed (${res.status}): ${await res.text()}`,
    );
  return res.json();
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function runEnqueue(moshafs: Map<number, Moshaf>): Promise<void> {
  let total = 0;
  for (const ext of EXTENSIONS) {
    const label = `[${ext.reciterSlug} / ${ext.style}]`;
    const moshaf = moshafs.get(ext.mp3quranMoshafId);
    if (!moshaf) {
      console.warn(
        `${label} mp3quran moshaf ${ext.mp3quranMoshafId} not found — skipping`,
      );
      continue;
    }
    const {missing} = await checkCdn(ext.r2Folder, moshaf.surahs);
    if (missing.length === 0) {
      console.log(`${label} all ${moshaf.surahs.length} surahs already on CDN`);
      continue;
    }
    console.log(`${label} ${missing.length} missing: ${missing.join(', ')}`);
    total += missing.length;
    if (DRY_RUN) continue;
    const files = missing.map(s => ({
      source_url: `${moshaf.server}/${fileName(s)}`,
      r2_key: `${ext.r2Folder}/${fileName(s)}`,
    }));
    for (let i = 0; i < files.length; i += ENQUEUE_BATCH_SIZE) {
      await enqueue(files.slice(i, i + ENQUEUE_BATCH_SIZE));
    }
  }
  console.log(`\n${DRY_RUN ? 'Would enqueue' : 'Enqueued'} ${total} files.`);
  if (!DRY_RUN && total > 0) {
    console.log(
      'When the Worker is done (upload-missing-to-r2 --status), run with --apply.',
    );
  }
}

async function runApply(moshafs: Map<number, Moshaf>): Promise<void> {
  const reciters = await fetchAllReciters();
  const bySlug = new Map(
    reciters.filter(r => r.slug).map(r => [r.slug as string, r]),
  );

  for (const ext of EXTENSIONS) {
    const label = `[${ext.reciterSlug} / ${ext.style}]`;
    const moshaf = moshafs.get(ext.mp3quranMoshafId);
    const reciter = bySlug.get(ext.reciterSlug);
    if (!moshaf || !reciter) {
      console.warn(
        `${label} ${!moshaf ? 'mp3quran moshaf' : 'reciter'} not found — skipping`,
      );
      continue;
    }

    const {present, missing} = await checkCdn(ext.r2Folder, moshaf.surahs);
    if (missing.length > 0) {
      console.warn(
        `${label} still missing on CDN: ${missing.join(', ')} — skipping until the Worker finishes`,
      );
      continue;
    }

    const existing = reciter.rewayat.find(
      r => r.name === ext.rewayahName && r.style === ext.style,
    );

    if (ext.newRewayah) {
      if (existing) {
        console.log(`${label} already exists (${existing.id}) — skipping`);
        continue;
      }
      const payload = {
        name: ext.rewayahName,
        style: ext.style,
        server: `${CDN_BASE}/${ext.r2Folder}`,
        source_type: 'bayaan',
        surah_total: present.length,
        surah_list: present,
      };
      console.log(
        `${label} create rewayah with ${present.length} surahs → ${payload.server}`,
      );
      if (!DRY_RUN)
        await adminRequest(
          'POST',
          `/admin/reciters/${reciter.id}/rewayat`,
          payload,
        );
      continue;
    }

    if (!existing) {
      console.warn(`${label} no matching rewayah on reciter — skipping`);
      continue;
    }
    const current = (existing.surah_list ?? []).filter(
      (n): n is number => n !== null,
    );
    const merged = [...new Set([...current, ...present])].sort((a, b) => a - b);
    if (merged.length === current.length) {
      console.log(`${label} surah_list already complete (${current.length})`);
      continue;
    }
    console.log(`${label} surah_list ${current.length} → ${merged.length}`);
    if (!DRY_RUN) {
      await adminRequest('PUT', `/admin/rewayat/${existing.id}`, {
        surah_list: merged,
        surah_total: merged.length,
      });
    }
  }
}

async function main(): Promise<void> {
  if (ENQUEUE === APPLY) {
    console.error(
      'Pass exactly one of --enqueue or --apply (optionally with --dry-run).',
    );
    process.exit(1);
  }
  requireEnv(
    ENQUEUE
      ? ['CDN_BASE', ...(DRY_RUN ? [] : ['WORKER_URL', 'AUTH_TOKEN'])]
      : [
          'CDN_BASE',
          'BAYAAN_API_URL',
          'BAYAAN_API_KEY',
          ...(DRY_RUN ? [] : ['ADMIN_EMAIL', 'ADMIN_PASSWORD']),
        ],
  );
  if (DRY_RUN) console.log('=== DRY RUN — no changes will be made ===\n');

  const moshafs = await fetchMoshafs();
  if (ENQUEUE) await runEnqueue(moshafs);
  else await runApply(moshafs);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
