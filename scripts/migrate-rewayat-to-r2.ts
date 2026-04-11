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
  slug: string;
  rewayat: RewayatEntry[];
}

interface PaginatedResponse {
  data: ReciterEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface MigrationResult {
  updated: number;
  skipped: number;
  failed: number;
  surahListFixed: number;
}

// ---------------------------------------------------------------------------
// Config / env
// ---------------------------------------------------------------------------

const API_URL = process.env.BAYAAN_API_URL;
const API_KEY = process.env.BAYAAN_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const DRY_RUN = process.argv.includes('--dry-run');
const R2_BASE = 'https://cdn.example.com/quran/recitations';
const PAGE_LIMIT = 200;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const missing: string[] = [];
  if (!API_URL) missing.push('BAYAAN_API_URL');
  if (!API_KEY) missing.push('BAYAAN_API_KEY');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Auth
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

  const data = (await res.json()) as {token: string};
  if (!data.token) {
    throw new Error('Authentication response missing token');
  }

  jwtToken = data.token;
  console.log('Authenticated successfully.');
  return jwtToken;
}

async function getToken(): Promise<string> {
  if (!jwtToken) {
    return authenticate();
  }
  return jwtToken;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchRecitersPage(page: number): Promise<PaginatedResponse> {
  const url = `${API_URL}/v1/reciters?page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: {Authorization: `Bearer ${API_KEY}`},
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
  const {totalPages} = first.meta;
  const all: ReciterEntry[] = [...first.data];

  console.log(
    `  Page 1/${totalPages} — ${first.data.length} reciters (total: ${first.meta.total})`,
  );

  for (let page = 2; page <= totalPages; page++) {
    const resp = await fetchRecitersPage(page);
    all.push(...resp.data);
    console.log(`  Page ${page}/${totalPages} — ${resp.data.length} reciters`);
  }

  console.log(`Fetched ${all.length} reciters total.\n`);
  return all;
}

type UpdatePayload =
  | {server: string; source_type: string}
  | {surah_list: number[]; surah_total: number};

async function updateRewayat(
  rewayatId: string,
  payload: UpdatePayload,
  retried = false,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/admin/rewayat/${rewayatId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401 && !retried) {
    console.log('  JWT expired — re-authenticating...');
    jwtToken = null;
    await authenticate();
    return updateRewayat(rewayatId, payload, true);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PUT /admin/rewayat/${rewayatId} failed (${res.status}): ${body}`,
    );
  }
}

async function verifyR2Url(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/001.mp3`, {method: 'HEAD'});
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slug building
// ---------------------------------------------------------------------------

function buildR2Url(
  reciterSlug: string,
  rewayahName: string,
  styleName: string,
  slugMappings: SlugMappings,
): string | null {
  const rewayahSlug = slugMappings.rewayat[rewayahName];
  if (!rewayahSlug) {
    return null;
  }

  const styleSlug =
    slugMappings.styles[styleName] ??
    slugMappings.styles[styleName.toLowerCase()];
  if (!styleSlug) {
    return null;
  }

  return `${R2_BASE}/${reciterSlug}/${rewayahSlug}/${styleSlug}/default`;
}

// ---------------------------------------------------------------------------
// surah_list cleanup
// ---------------------------------------------------------------------------

function cleanSurahList(surahList: (number | null)[] | null): number[] | null {
  if (!surahList) return null;
  const cleaned = surahList.filter(
    (n): n is number => n !== null && typeof n === 'number',
  );
  return cleaned.length > 0 ? cleaned : null;
}

function hasNullEntries(surahList: (number | null)[] | null): boolean {
  if (!surahList) return false;
  return surahList.some(n => n === null);
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function migrate(): Promise<void> {
  validateEnv();

  if (DRY_RUN) {
    console.log('=== DRY RUN — no changes will be made ===\n');
  }

  const slugsPath = path.resolve(__dirname, '../data/rewayat-slugs.json');
  const slugMappings: SlugMappings = JSON.parse(
    fs.readFileSync(slugsPath, 'utf8'),
  );

  await authenticate();
  const reciters = await fetchAllReciters();

  const result: MigrationResult = {
    updated: 0,
    skipped: 0,
    failed: 0,
    surahListFixed: 0,
  };

  for (const reciter of reciters) {
    if (!reciter.rewayat || reciter.rewayat.length === 0) continue;

    for (const rewayat of reciter.rewayat) {
      const prefix = `[${reciter.name} / ${rewayat.name} (${rewayat.style})]`;

      // ------------------------------------------------------------------
      // Fix bad surah_list data (separate update, always done even if server
      // is already on R2)
      // ------------------------------------------------------------------
      if (hasNullEntries(rewayat.surah_list)) {
        const cleaned = cleanSurahList(rewayat.surah_list);
        if (cleaned) {
          console.log(`${prefix} Fixing surah_list (has null entries)`);
          if (!DRY_RUN) {
            try {
              await updateRewayat(rewayat.id, {
                surah_list: cleaned,
                surah_total: cleaned.length,
              });
              result.surahListFixed++;
            } catch (err) {
              console.error(`${prefix} Failed to fix surah_list:`, err);
            }
          } else {
            result.surahListFixed++;
          }
        }
      }

      // ------------------------------------------------------------------
      // Skip if already on R2
      // ------------------------------------------------------------------
      if (rewayat.server && rewayat.server.includes('cdn.example.com')) {
        console.log(`${prefix} Already on R2 — skipping`);
        result.skipped++;
        continue;
      }

      // ------------------------------------------------------------------
      // Build R2 URL
      // ------------------------------------------------------------------
      if (!reciter.slug) {
        console.warn(`${prefix} Reciter has no slug — skipping`);
        result.failed++;
        continue;
      }

      const r2Url = buildR2Url(
        reciter.slug,
        rewayat.name,
        rewayat.style,
        slugMappings,
      );

      if (!r2Url) {
        console.warn(
          `${prefix} Cannot build R2 URL (unmapped rewayah or style: "${rewayat.name}" / "${rewayat.style}") — skipping`,
        );
        result.failed++;
        continue;
      }

      // ------------------------------------------------------------------
      // Verify R2 URL resolves before committing
      // ------------------------------------------------------------------
      console.log(`${prefix} Verifying ${r2Url}/001.mp3 ...`);
      const verified = await verifyR2Url(r2Url);
      if (!verified) {
        console.warn(
          `${prefix} R2 verification failed (HEAD 001.mp3 not 200) — skipping`,
        );
        result.failed++;
        continue;
      }

      // ------------------------------------------------------------------
      // Update DB
      // ------------------------------------------------------------------
      console.log(`${prefix} Updating server → ${r2Url}`);
      if (!DRY_RUN) {
        try {
          await updateRewayat(rewayat.id, {
            server: r2Url,
            source_type: 'bayaan',
          });
          result.updated++;
        } catch (err) {
          console.error(`${prefix} Update failed:`, err);
          result.failed++;
        }
      } else {
        result.updated++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n=== Migration Summary ===');
  if (DRY_RUN) console.log('(DRY RUN — no changes were written)');
  console.log(`  Updated:           ${result.updated}`);
  console.log(`  Skipped (already): ${result.skipped}`);
  console.log(`  Failed / unmapped: ${result.failed}`);
  console.log(`  surah_list fixed:  ${result.surahListFixed}`);
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
