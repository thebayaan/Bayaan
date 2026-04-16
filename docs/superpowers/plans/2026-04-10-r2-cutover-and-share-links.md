# R2 Audio Cutover & Shareable Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all audio URLs to Cloudflare R2 (`cdn.example.com`), then build shareable deep links on `app.thebayaan.com` with auto-play, verse sharing, and rich OG previews.

**Architecture:** DB migration script updates 243 rewayat server URLs through the backend admin API. App-side changes bust cached data and add slug resolution. Share link receiver screens use Expo Router file-based routing, resolving slugs client-side from in-memory reciter data. Backend serves OG cards for bot crawlers and redirects humans to app stores.

**Tech Stack:** React Native/Expo SDK 54, Expo Router v4, Zustand, Hono/Bun backend, PostgreSQL (Drizzle ORM), Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-04-10-r2-cutover-and-share-links-design.md`

**Repos:**
- App: `/Users/osmansaeday/theBayaan/Bayaan`
- Backend: `/Users/osmansaeday/theBayaan/bayaan-backend`

---

## Phase 1: R2 Audio Cutover

### Task 1: Copy `rewayat-slugs.json` from R2 POC branch

**Files:**
- Create: `data/rewayat-slugs.json`

- [ ] **Step 1: Extract file from R2 POC branch**

```bash
cd /Users/osmansaeday/theBayaan/Bayaan
git show feature/r2-audio-poc:data/rewayat-slugs.json > data/rewayat-slugs.json
```

- [ ] **Step 2: Verify the file has correct structure**

```bash
cat data/rewayat-slugs.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'Rewayat mappings: {len(d[\"rewayat\"])}')
print(f'Style mappings: {len(d[\"styles\"])}')
assert 'rewayat' in d and 'styles' in d, 'Missing keys'
assert d['rewayat']['Hafs A\\'n Assem'] == 'hafs', 'Bad Hafs mapping'
print('Structure OK')
"
```

Expected: `Rewayat mappings: 29`, `Style mappings: 8`, `Structure OK`

- [ ] **Step 3: Verify all DB rewayat names are covered**

```bash
curl -s "https://bayaan-backend-production.up.railway.app/v1/reciters?page=1&limit=200" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_BAYAAN_API_KEY .env | cut -d= -f2)" | \
python3 -c "
import json, sys
slugs = json.load(open('data/rewayat-slugs.json'))
data = json.load(sys.stdin)
missing_names = set()
missing_styles = set()
for r in data.get('data', []):
    for rw in r.get('rewayat', []):
        if rw['name'] not in slugs['rewayat']:
            missing_names.add(rw['name'])
        if rw['style'] not in slugs['styles']:
            missing_styles.add(rw['style'])
if missing_names: print(f'MISSING rewayat names: {missing_names}')
if missing_styles: print(f'MISSING styles: {missing_styles}')
if not missing_names and not missing_styles: print('All names and styles covered')
"
```

Expected: `All names and styles covered` — if any are missing, add them to the JSON before proceeding.

- [ ] **Step 4: Commit**

```bash
git add data/rewayat-slugs.json
git commit -m "chore: add rewayat-slugs.json for R2 URL mapping"
```

---

### Task 2: Write and run DB migration script

**Files:**
- Create: `scripts/migrate-rewayat-to-r2.ts`

This script updates every rewayat row's `server` column to the R2 CDN URL via the backend admin API.

- [ ] **Step 1: Create the migration script**

```typescript
// scripts/migrate-rewayat-to-r2.ts
// Run with: npx tsx scripts/migrate-rewayat-to-r2.ts
//
// Env vars required:
//   BAYAAN_API_URL - backend URL (e.g., https://bayaan-backend-production.up.railway.app)
//   BAYAAN_API_KEY - API key for GET /v1/reciters
//   ADMIN_EMAIL    - admin login email
//   ADMIN_PASSWORD - admin login password

import rewayatSlugs from '../data/rewayat-slugs.json';

const API_URL = process.env.BAYAAN_API_URL;
const API_KEY = process.env.BAYAAN_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const R2_CDN_BASE = 'https://cdn.example.com';
const DRY_RUN = process.argv.includes('--dry-run');

if (!API_URL || !API_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing required env vars: BAYAAN_API_URL, BAYAAN_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(1);
}

interface Rewayat {
  id: string;
  name: string;
  style: string;
  server: string;
  source_type: string;
  surah_total: number;
  surah_list: (number | null)[];
  is_active?: boolean;
}

interface Reciter {
  id: string;
  name: string;
  slug: string | null;
  rewayat: Rewayat[];
}

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data.token;
}

async function fetchAllReciters(): Promise<Reciter[]> {
  const allReciters: Reciter[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API_URL}/v1/reciters?page=${page}&limit=200`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Fetch reciters failed: ${res.status}`);
    const json = await res.json();
    allReciters.push(...(json.data ?? []));
    if (!json.meta?.total_pages || page >= json.meta.total_pages) break;
    page++;
  }
  return allReciters;
}

function buildR2Url(reciterSlug: string, rewayat: Rewayat): string | null {
  const rewayahSlug = (rewayatSlugs.rewayat as Record<string, string>)[rewayat.name];
  const styleSlug = (rewayatSlugs.styles as Record<string, string>)[rewayat.style];

  if (!rewayahSlug) return null;
  if (!styleSlug) return null;

  return `${R2_CDN_BASE}/quran/recitations/${reciterSlug}/${rewayahSlug}/${styleSlug}/default`;
}

async function verifyR2Url(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/001.mp3`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function updateRewayat(
  id: string,
  server: string,
  token: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/admin/rewayat/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ server, source_type: 'bayaan' }),
  });
  return res.ok;
}

async function fixBadSurahList(
  id: string,
  surahList: number[],
  surahTotal: number,
  token: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/admin/rewayat/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ surah_list: surahList, surah_total: surahTotal }),
  });
  return res.ok;
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  let token = await getAdminToken();
  const reciters = await fetchAllReciters();

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let dataFixed = 0;
  const failures: string[] = [];

  for (const reciter of reciters) {
    if (!reciter.slug) {
      failures.push(`${reciter.name}: no slug`);
      skipped += reciter.rewayat.length;
      continue;
    }

    for (const rw of reciter.rewayat) {
      // Fix bad surah_list entries (null values)
      const nullCount = rw.surah_list.filter(s => s === null).length;
      if (nullCount > 0) {
        const cleanList = rw.surah_list.filter((s): s is number => s !== null);
        console.log(`  FIX ${reciter.name} / ${rw.name}: removing ${nullCount} null entries from surah_list`);
        if (!DRY_RUN) {
          const fixed = await fixBadSurahList(rw.id, cleanList, cleanList.length, token);
          if (fixed) dataFixed++;
          else failures.push(`${reciter.name} / ${rw.name}: failed to fix surah_list`);
        }
      }

      // Build R2 URL
      const r2Url = buildR2Url(reciter.slug, rw);
      if (!r2Url) {
        failures.push(`${reciter.name} / ${rw.name} (${rw.style}): no slug mapping`);
        skipped++;
        continue;
      }

      // Skip if already pointing to R2
      if (rw.server.startsWith(R2_CDN_BASE)) {
        console.log(`  SKIP ${reciter.name} / ${rw.name}: already on R2`);
        skipped++;
        continue;
      }

      // Verify R2 URL
      const verified = await verifyR2Url(r2Url);
      if (!verified) {
        failures.push(`${reciter.name} / ${rw.name}: R2 verification failed (${r2Url}/001.mp3)`);
        failed++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  WOULD UPDATE ${reciter.name} / ${rw.name}: ${rw.server} → ${r2Url}`);
        updated++;
        continue;
      }

      // Update via admin API
      const success = await updateRewayat(rw.id, r2Url, token);
      if (success) {
        console.log(`  UPDATED ${reciter.name} / ${rw.name}: → ${r2Url}`);
        updated++;
      } else {
        // May be JWT expired — re-auth and retry once
        try {
          token = await getAdminToken();
          const retry = await updateRewayat(rw.id, r2Url, token);
          if (retry) {
            console.log(`  UPDATED (retry) ${reciter.name} / ${rw.name}: → ${r2Url}`);
            updated++;
          } else {
            failures.push(`${reciter.name} / ${rw.name}: API update failed after retry`);
            failed++;
          }
        } catch {
          failures.push(`${reciter.name} / ${rw.name}: re-auth failed`);
          failed++;
        }
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Data fixes: ${dataFixed}`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run in dry-run mode**

```bash
BAYAAN_API_URL=https://bayaan-backend-production.up.railway.app \
BAYAAN_API_KEY=$(grep EXPO_PUBLIC_BAYAAN_API_KEY .env | cut -d= -f2) \
ADMIN_EMAIL=<your-admin-email> \
ADMIN_PASSWORD=<your-admin-password> \
npx tsx scripts/migrate-rewayat-to-r2.ts --dry-run
```

Expected: Lists all rewayat that WOULD be updated, reports any missing slug mappings or verification failures. No DB changes.

- [ ] **Step 3: Fix any missing slug mappings reported by dry-run**

If the dry-run reports missing names or styles, add them to `data/rewayat-slugs.json` and re-run dry-run until clean.

- [ ] **Step 4: Run live migration**

```bash
BAYAAN_API_URL=https://bayaan-backend-production.up.railway.app \
BAYAAN_API_KEY=$(grep EXPO_PUBLIC_BAYAAN_API_KEY .env | cut -d= -f2) \
ADMIN_EMAIL=<your-admin-email> \
ADMIN_PASSWORD=<your-admin-password> \
npx tsx scripts/migrate-rewayat-to-r2.ts
```

Expected: All rewayat updated (except those already on R2). Summary shows 0 failures.

- [ ] **Step 5: Verify migration by spot-checking the API**

```bash
curl -s "https://bayaan-backend-production.up.railway.app/v1/reciters?page=1&limit=5" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_BAYAAN_API_KEY .env | cut -d= -f2)" | \
python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data['data']:
    for rw in r['rewayat']:
        ok = '✓' if rw['server'].startswith('https://cdn.example.com') else '✗'
        print(f'  {ok} {r[\"name\"]} / {rw[\"name\"]}: {rw[\"server\"][:60]}...')
"
```

Expected: All rows show `✓` with `cdn.example.com` URLs.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-rewayat-to-r2.ts
git commit -m "chore: add R2 migration script for rewayat server URLs"
```

---

### Task 3: App-side backwards compatibility

**Files:**
- Modify: `services/dataService.ts:14` (DATA_VERSION)
- Modify: `services/dataService.ts:185-193` (add getReciterBySlug)
- Modify: `services/player/store/playerStore.ts` (stale URL migration)

- [ ] **Step 1: Bump DATA_VERSION to bust cached reciter data**

In `services/dataService.ts`, change line 14:

```typescript
const DATA_VERSION = '4'; // Increment: R2 migration — bust cached mp3quran/Supabase URLs
```

- [ ] **Step 2: Add `getReciterBySlug` to dataService**

In `services/dataService.ts`, after `getReciterByIdSync` (after line 193), add:

```typescript
export function getReciterBySlug(slug: string): Reciter | undefined {
  return RECITERS.find(r => r.slug === slug);
}
```

- [ ] **Step 3: Add stale URL migration to player store initialization**

In `services/player/store/playerStore.ts`, find the persist middleware `onRehydrateStorage` or add a one-time migration check. After the store is created, add a migration that runs on rehydration:

Find the `persist` config (around the `STORAGE_KEY` usage) and add an `onRehydrateStorage` callback that clears stale URLs:

```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return;
  const tracks = state.queue?.tracks ?? [];
  const hasStaleUrls = tracks.some(
    (t) => t.url.includes('mp3quran.net') || t.url.includes('supabase.co'),
  );
  if (hasStaleUrls) {
    console.log('[PlayerStore] Clearing stale URLs from persisted queue');
    state.queue = { ...state.queue, tracks: [], currentIndex: 0, total: 0 };
  }
},
```

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add services/dataService.ts services/player/store/playerStore.ts
git commit -m "feat: R2 backwards compatibility — bust cached URLs and add slug lookup"
```

---

### Task 4: Smoke test audio playback

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Test playback from 3 different reciters**

Play audio from:
1. A former mp3quran reciter (e.g., Abdulbasit Abdulsamad)
2. A former Supabase reciter (e.g., Mohammed Jibreel)
3. A reciter that was already on R2 (e.g., one of the 14 already migrated)

Verify audio plays correctly for each. Check the console logs for the audio URL — it should be a `cdn.example.com` URL.

- [ ] **Step 3: Test player resume**

Kill and restart the app. Verify the player does NOT try to resume with a stale mp3quran/Supabase URL. If the queue was cleared, the player should start fresh.

---

## Phase 2: Share Links

### Task 5: Set up `app.thebayaan.com` domain

This is an infrastructure task, not a code task.

- [ ] **Step 1: Configure `app.thebayaan.com` DNS**

In Cloudflare DNS for `thebayaan.com`, add a CNAME record:
- Name: `app`
- Target: Railway backend's public domain (or set up a Cloudflare Worker that proxies to Railway)

The domain MUST serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` over HTTPS with no redirect chain and `Content-Type: application/json`.

- [ ] **Step 2: Verify AASA is served correctly**

```bash
curl -sI "https://app.thebayaan.com/.well-known/apple-app-site-association" | head -5
```

Expected: `HTTP/2 200`, `content-type: application/json`

- [ ] **Step 3: Verify assetlinks.json is served**

```bash
curl -s "https://app.thebayaan.com/.well-known/assetlinks.json" | python3 -m json.tool
```

Expected: Valid JSON with `com.bayaan.app` package name.

---

### Task 6: Backend bug fixes and domain update

**Files:**
- Modify: `bayaan-backend/src/routes/share/index.ts` (App Store ID, domain, dead code)
- Modify: `bayaan-backend/src/lib/ogTemplate.ts` (App Store URL format)

- [ ] **Step 1: Fix App Store ID and domain in `share/index.ts`**

In `bayaan-backend/src/routes/share/index.ts`, update the constants at the top:

```typescript
const BASE_URL = 'https://app.thebayaan.com';
const IOS_STORE_URL = 'https://apps.apple.com/us/app/bayaan/id6648769980';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bayaan.app';
```

- [ ] **Step 2: Remove `storeRedirectUrl()` dead code**

Delete the `storeRedirectUrl()` function (lines 62-66 in `share/index.ts`).

- [ ] **Step 3: Fix App Store URL in `ogTemplate.ts`**

In `bayaan-backend/src/lib/ogTemplate.ts`, line 1:

```typescript
const IOS_STORE_URL = 'https://apps.apple.com/us/app/bayaan/id6648769980';
```

Also update the `APP_ICON_URL` to point to a valid location (host on R2 or serve as a static file):

```typescript
const APP_ICON_URL = 'https://cdn.example.com/assets/og-default.png';
```

- [ ] **Step 4: Upload `og-default.png` to R2**

Upload the app icon to the R2 bucket at `assets/og-default.png` so the OG image URL actually resolves.

- [ ] **Step 5: Set `ANDROID_SHA256_CERT` env var on Railway**

Extract the fingerprint:
```bash
keytool -list -v -keystore ~/Documents/app-credentials/bayaan/keystore/bayaan-upload-key.keystore | grep SHA256
```

Set it as an env var on Railway for the backend service.

- [ ] **Step 6: Commit backend changes**

```bash
cd /Users/osmansaeday/theBayaan/bayaan-backend
git add src/routes/share/index.ts src/lib/ogTemplate.ts
git commit -m "fix: correct App Store ID, update share domain to app.thebayaan.com, remove dead code"
```

---

### Task 7: Backend — new share route handlers

**Files:**
- Modify: `bayaan-backend/src/routes/share/index.ts` (add recitation, verse, dhikr routes; delete old surah route, playlist route)

- [ ] **Step 1: Replace old surah route with new recitation route**

Delete the old `app.get('/reciter/:slug/surah/:num', ...)` handler. Add the new one that includes rewayat and style:

```typescript
// ── Recitation (auto-play) ──────────────────────────────────────────────────

app.get('/reciter/:slug/:rewayat/:style/surah/:num', async (c) => {
  const { slug, rewayat, style, num } = c.req.param();
  const surahNum = parseInt(num, 10);
  const shareUrl = `${BASE_URL}/share/reciter/${slug}/${rewayat}/${style}/surah/${num}`;
  const ua = c.req.header('user-agent');

  const surahName = SURAH_NAMES[surahNum] ?? `Surah ${num}`;
  let reciterName = slug;
  let imageUrl: string | undefined;

  try {
    const reciter = await getReciterBySlug(slug);
    reciterName = reciter.name;
    imageUrl = reciter.image_url ?? undefined;
  } catch {
    // Use slug as fallback name
  }

  const title = `${surahName} — ${reciterName}`;
  const description = `Listen to Surah ${surahName} recited by ${reciterName} on Bayaan.`;

  if (isBotUA(ua)) {
    return c.html(buildOgHtml({ title, description, imageUrl, pageUrl: shareUrl }));
  }

  const isAndroid = /android/i.test(ua ?? '');
  return c.redirect(isAndroid ? ANDROID_STORE_URL : IOS_STORE_URL, 302);
});
```

- [ ] **Step 2: Add verse share route**

```typescript
// ── Verse ────────────────────────────────────────────────────────────────────

app.get('/verse/:surah/:ayah', (c) => {
  const { surah, ayah } = c.req.param();
  const surahNum = parseInt(surah, 10);
  const shareUrl = `${BASE_URL}/share/verse/${surah}/${ayah}`;
  const ua = c.req.header('user-agent');

  const surahName = SURAH_NAMES[surahNum] ?? `Surah ${surah}`;
  const title = `${surahName}, Verse ${ayah}`;
  const description = `Read ${surahName} verse ${ayah} in Bayaan's Mushaf reader.`;

  if (isBotUA(ua)) {
    return c.html(buildOgHtml({ title, description, pageUrl: shareUrl }));
  }

  const isAndroid = /android/i.test(ua ?? '');
  return c.redirect(isAndroid ? ANDROID_STORE_URL : IOS_STORE_URL, 302);
});
```

- [ ] **Step 3: Add dhikr share route**

```typescript
// ── Dhikr ────────────────────────────────────────────────────────────────────

app.get('/dhikr/:superId/:dhikrId', (c) => {
  const { superId, dhikrId } = c.req.param();
  const shareUrl = `${BASE_URL}/share/dhikr/${superId}/${dhikrId}`;
  const ua = c.req.header('user-agent');

  const title = 'Dhikr — Bayaan';
  const description = 'Read and track your daily adhkar (remembrance) in the Bayaan app.';

  if (isBotUA(ua)) {
    return c.html(buildOgHtml({ title, description, pageUrl: shareUrl }));
  }

  const isAndroid = /android/i.test(ua ?? '');
  return c.redirect(isAndroid ? ANDROID_STORE_URL : IOS_STORE_URL, 302);
});
```

- [ ] **Step 4: Delete playlist route**

Remove the entire `app.get('/playlist/:id', ...)` handler.

- [ ] **Step 5: Commit**

```bash
cd /Users/osmansaeday/theBayaan/bayaan-backend
git add src/routes/share/index.ts
git commit -m "feat: add recitation, verse, dhikr share routes; remove old surah and playlist routes"
```

---

### Task 8: App — update `app.config.js` and `shareUtils.ts`

**Files:**
- Modify: `app.config.js` (~line 26, ~line 97)
- Modify: `utils/shareUtils.ts` (full rewrite)

- [ ] **Step 1: Update `associatedDomains` in `app.config.js`**

Change `associatedDomains` from:
```javascript
associatedDomains: ['applinks:api.thebayaan.com'],
```
to:
```javascript
associatedDomains: ['applinks:app.thebayaan.com'],
```

- [ ] **Step 2: Update `intentFilters` host in `app.config.js`**

Find the `intentFilters` array and change `data.host` from `api.thebayaan.com` to `app.thebayaan.com`.

- [ ] **Step 3: Rewrite `shareUtils.ts`**

Replace the entire contents of `utils/shareUtils.ts`:

```typescript
import {Share, Platform} from 'react-native';
import rewayatSlugs from '@/data/rewayat-slugs.json';
import type {Reciter, Rewayat} from '@/data/reciterData';

const BASE_URL = 'https://app.thebayaan.com';

export function reciterShareUrl(slug: string): string {
  return `${BASE_URL}/share/reciter/${slug}`;
}

export function recitationShareUrl(
  reciterSlug: string,
  rewayatSlug: string,
  styleSlug: string,
  surahNum: number,
  timestampSec?: number,
): string {
  const base = `${BASE_URL}/share/reciter/${reciterSlug}/${rewayatSlug}/${styleSlug}/surah/${surahNum}`;
  return timestampSec ? `${base}?t=${timestampSec}` : base;
}

export function mushafShareUrl(page: number): string {
  return `${BASE_URL}/share/mushaf/${page}`;
}

export function verseShareUrl(surah: number, ayah: number): string {
  return `${BASE_URL}/share/verse/${surah}/${ayah}`;
}

export function adhkarShareUrl(superId: string): string {
  return `${BASE_URL}/share/adhkar/${superId}`;
}

export function dhikrShareUrl(superId: string, dhikrId: string): string {
  return `${BASE_URL}/share/dhikr/${superId}/${dhikrId}`;
}

export function getRewayatSlug(rewayat: Rewayat): string | null {
  return (rewayatSlugs.rewayat as Record<string, string>)[rewayat.name] ?? null;
}

export function getStyleSlug(rewayat: Rewayat): string {
  return (rewayatSlugs.styles as Record<string, string>)[rewayat.style] ?? 'murattal';
}

export function resolveRewayat(
  reciter: Reciter,
  rewayatSlug: string,
  styleSlug: string,
): Rewayat | undefined {
  return reciter.rewayat.find(rw => {
    const nameSlug = (rewayatSlugs.rewayat as Record<string, string>)[rw.name];
    const stSlug = (rewayatSlugs.styles as Record<string, string>)[rw.style] ?? 'murattal';
    return nameSlug === rewayatSlug && stSlug === styleSlug;
  });
}

export async function shareUrl(url: string, message: string): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({url, message});
    } else {
      await Share.share({message: `${message}\n${url}`});
    }
  } catch {
    // User dismissed or share failed
  }
}
```

- [ ] **Step 4: Run type check and format**

```bash
npx tsc --noEmit
npx prettier --write utils/shareUtils.ts app.config.js
```

- [ ] **Step 5: Commit**

```bash
git add utils/shareUtils.ts app.config.js
git commit -m "feat: update share domain to app.thebayaan.com and rewrite share URL generators"
```

---

### Task 9: App — add `isInitialized` flag for cold-start deep links

**Files:**
- Modify: `store/reciterStore.ts` (add `isInitialized` flag)
- Modify: `services/dataService.ts` (set flag after population)

- [ ] **Step 1: Add `isInitialized` to reciter store**

In `store/reciterStore.ts`, add to the `ReciterState` interface:

```typescript
interface ReciterState {
  defaultReciter: Reciter;
  isInitialized: boolean;
  setDefaultReciter: (reciter: Reciter) => void;
  refreshDefaultReciter: () => void;
}
```

And in the store creation, add the initial value:

```typescript
export const useReciterStore = create<ReciterState>()(
  persist(
    set => ({
      defaultReciter: getDefaultReciter(),
      isInitialized: false,
      // ... rest of store
```

Note: `isInitialized` should NOT be persisted — it must start `false` on every app launch. Add it to the persist config's `partialize` to exclude it:

```typescript
partialize: (state) => ({ defaultReciter: state.defaultReciter }),
```

- [ ] **Step 2: Set `isInitialized` after reciter data loads**

In `services/dataService.ts`, in the `populateReciters` function, after the splice:

```typescript
function populateReciters(data: Reciter[]): void {
  RECITERS.splice(0, RECITERS.length, ...data);
  useReciterStore.getState().refreshDefaultReciter();
  useReciterStore.setState({ isInitialized: true });
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add store/reciterStore.ts services/dataService.ts
git commit -m "feat: add isInitialized flag for cold-start deep link handling"
```

---

### Task 10: App — rewrite share receiver screens

**Files:**
- Modify: `app/share/reciter/[slug].tsx` (fix slug resolution)
- Delete: `app/share/reciter/[slug]/surah/[num].tsx`
- Create: `app/share/reciter/[slug]/[rewayat]/[style]/surah/[num].tsx`
- Modify: `app/share/mushaf/[page].tsx` (fix theme.colors.primary)
- Modify: `app/share/adhkar/[superId].tsx` (fix theme.colors.primary)
- Create: `app/share/verse/[surah]/[ayah].tsx`
- Create: `app/share/dhikr/[superId]/[dhikrId].tsx`
- Delete: `app/share/playlist/[id].tsx`

- [ ] **Step 1: Rewrite reciter receiver `[slug].tsx`**

Replace `app/share/reciter/[slug].tsx`:

```typescript
import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterBySlug} from '@/services/dataService';

export default function ShareReciterReceiver() {
  const {slug} = useLocalSearchParams<{slug: string}>();
  const router = useRouter();
  const {theme} = useTheme();
  const isInitialized = useReciterStore(s => s.isInitialized);

  useEffect(() => {
    if (!isInitialized || !slug) return;

    const reciter = getReciterBySlug(slug);
    if (!reciter) {
      router.replace('/');
      return;
    }

    router.replace({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: reciter.id},
    });
  }, [isInitialized, slug, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
```

- [ ] **Step 2: Delete old surah receiver**

```bash
rm app/share/reciter/\[slug\]/surah/\[num\].tsx
rmdir app/share/reciter/\[slug\]/surah 2>/dev/null
```

- [ ] **Step 3: Create recitation receiver with auto-play**

Create `app/share/reciter/[slug]/[rewayat]/[style]/surah/[num].tsx`:

```bash
mkdir -p "app/share/reciter/[slug]/[rewayat]/[style]/surah"
```

```typescript
import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {useReciterStore} from '@/store/reciterStore';
import {getReciterBySlug} from '@/services/dataService';
import {resolveRewayat} from '@/utils/shareUtils';
import {usePlayerActions} from '@/hooks/usePlayerActions';

export default function ShareRecitationReceiver() {
  const {slug, rewayat, style, num} = useLocalSearchParams<{
    slug: string;
    rewayat: string;
    style: string;
    num: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();
  const isInitialized = useReciterStore(s => s.isInitialized);
  const {playTrack} = usePlayerActions();

  useEffect(() => {
    if (!isInitialized || !slug || !rewayat || !style || !num) return;

    const reciter = getReciterBySlug(slug);
    if (!reciter) {
      router.replace('/');
      return;
    }

    const rw = resolveRewayat(reciter, rewayat, style);
    if (!rw) {
      router.replace({
        pathname: '/(tabs)/(a.home)/reciter/[id]',
        params: {id: reciter.id},
      });
      return;
    }

    const surahNum = parseInt(num, 10);

    playTrack({
      reciterId: reciter.id,
      rewayatId: rw.id,
      surahId: surahNum,
    });

    router.replace({
      pathname: '/(tabs)/(a.home)/reciter/[id]',
      params: {id: reciter.id, surah: num, rewayatId: rw.id},
    });
  }, [isInitialized, slug, rewayat, style, num, router, playTrack]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
```

Note: The `playTrack` call above assumes `usePlayerActions` has a method that accepts `{ reciterId, rewayatId, surahId }`. Check the actual hook signature and adjust — the key is to trigger playback before navigating. The `?t=` timestamp param handling should seek after load; check if the current player service supports seeking on load.

- [ ] **Step 4: Create verse receiver**

Create `app/share/verse/[surah]/[ayah].tsx`:

```bash
mkdir -p "app/share/verse/[surah]"
```

```typescript
import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareVerseReceiver() {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah: string}>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!surah || !ayah) {
      router.replace('/');
      return;
    }

    router.replace({
      pathname: '/mushaf',
      params: {surah, ayah},
    });
  }, [surah, ayah, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
```

Note: The mushaf screen may need modification to accept and handle `surah` + `ayah` params for scrolling/highlighting. Check the mushaf route and component to verify it supports these params.

- [ ] **Step 5: Create dhikr receiver**

Create `app/share/dhikr/[superId]/[dhikrId].tsx`:

```bash
mkdir -p "app/share/dhikr/[superId]"
```

```typescript
import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';

export default function ShareDhikrReceiver() {
  const {superId, dhikrId} = useLocalSearchParams<{
    superId: string;
    dhikrId: string;
  }>();
  const router = useRouter();
  const {theme} = useTheme();

  useEffect(() => {
    if (!superId || !dhikrId) {
      router.replace('/');
      return;
    }

    router.replace({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {superId, dhikrId},
    });
  }, [superId, dhikrId, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.text} />
    </View>
  );
}
```

- [ ] **Step 6: Fix `theme.colors.primary` in mushaf and adhkar receivers**

In `app/share/mushaf/[page].tsx` and `app/share/adhkar/[superId].tsx`, replace `theme.colors.primary` with `theme.colors.text` in the `ActivityIndicator` `color` prop.

- [ ] **Step 7: Delete playlist receiver**

```bash
rm app/share/playlist/\[id\].tsx
rmdir app/share/playlist 2>/dev/null
```

- [ ] **Step 8: Run type check and format**

```bash
npx tsc --noEmit
npx prettier --write "app/share/**/*.tsx"
```

- [ ] **Step 9: Commit**

```bash
git add -A app/share/ utils/shareUtils.ts
git commit -m "feat: rewrite share receiver screens with slug resolution, auto-play, and new link types"
```

---

### Task 11: App — add share buttons throughout the app

This task adds share entry points to screens that don't have them yet. Each share button imports the appropriate URL generator from `shareUtils.ts` and calls `shareUrl()`.

**Files:**
- Modify: `components/reciter-profile/ReciterProfile.tsx` (update existing share to use recitation URLs for surah rows)
- Modify: Player sheet component (add share button for current track)
- Modify: Mushaf toolbar (add share button for current page)
- Modify: Verse actions sheet (add share option)
- Modify: Adhkar category screen (add share button)
- Modify: Dhikr reader (add share button)

This task requires exploring the exact component files and their current structure. The implementer should:

- [ ] **Step 1: Update ReciterProfile share button**

The existing share button at `ReciterProfile.tsx:245-249` uses `reciterShareUrl(slug)`. Keep this for the header share. For surah rows, add a share action that generates `recitationShareUrl(slug, rewayatSlug, styleSlug, surahNum)` using the currently selected rewayat.

- [ ] **Step 2: Add share to player sheet**

Find the player sheet component (likely in `components/player/`). Add a share button that shares the currently playing track as a recitation link with timestamp:

```typescript
import {recitationShareUrl, getRewayatSlug, getStyleSlug, shareUrl} from '@/utils/shareUtils';
// ... inside the component:
const currentTrack = usePlayerStore(s => s.queue.tracks[s.queue.currentIndex]);
// Build share URL from track metadata
```

- [ ] **Step 3: Add share to mushaf toolbar**

Find the mushaf toolbar and add a share button:

```typescript
import {mushafShareUrl, shareUrl} from '@/utils/shareUtils';
// shareUrl(mushafShareUrl(currentPage), `Quran — Page ${currentPage}`)
```

- [ ] **Step 4: Add share to verse actions sheet**

Find the verse actions sheet (likely `VerseActionsSheet.tsx`) and add a share option with the configurable text format described in the spec.

- [ ] **Step 5: Add share to adhkar and dhikr screens**

Add share buttons to the adhkar category screen and dhikr reader.

- [ ] **Step 6: Run type check and format all modified files**

```bash
npx tsc --noEmit
npx prettier --write <all-modified-files>
```

- [ ] **Step 7: Commit**

```bash
git add <all-modified-files>
git commit -m "feat: add share buttons to player, mushaf, verse actions, adhkar, and dhikr screens"
```

---

### Task 12: Native rebuild and release

- [ ] **Step 1: Prebuild iOS**

```bash
expo prebuild --platform ios --clean
```

Verify `ios/Bayaan/Bayaan.entitlements` now contains `applinks:app.thebayaan.com`.

- [ ] **Step 2: Prebuild Android**

```bash
expo prebuild --platform android --clean
```

Verify `android/app/src/main/AndroidManifest.xml` intent filter now references `app.thebayaan.com`.

- [ ] **Step 3: Test on device**

Test a share link end-to-end:
1. Share a reciter link from the app
2. Open it on another device (or same device in Safari)
3. Verify it opens the app and navigates correctly

- [ ] **Step 4: Build and submit**

Follow the deployment process in `docs/deployment/deployment.md`.

---

## Phase 3: Rich OG Cards

### Task 13: POC — `satori` + `@resvg/resvg-js` on Hono/Bun

**Files:**
- Create: `bayaan-backend/src/lib/ogImage.ts`
- Modify: `bayaan-backend/package.json` (add dependencies)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/osmansaeday/theBayaan/bayaan-backend
bun add satori @resvg/resvg-js
```

- [ ] **Step 2: Create OG image generation service**

Create `src/lib/ogImage.ts` with a function that takes title, description, and optional image URL, renders a branded card using `satori`, converts to PNG with `@resvg/resvg-js`, and returns the buffer.

The implementer should follow the `satori` docs for JSX-to-SVG rendering and `@resvg/resvg-js` for SVG-to-PNG conversion. Test that it works in Bun's runtime.

- [ ] **Step 3: Test with a simple endpoint**

Add a test route like `GET /share/test-og` that returns a generated PNG. Open in browser to verify the image renders correctly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ogImage.ts package.json bun.lockb
git commit -m "feat: add OG image generation with satori + resvg"
```

---

### Task 14: Integrate OG images into share routes

**Files:**
- Modify: `bayaan-backend/src/routes/share/index.ts` (generate and serve images)
- Modify: `bayaan-backend/src/lib/ogTemplate.ts` (accept dynamic image URLs)

- [ ] **Step 1: Add image generation to each share route**

For each route handler, generate a dynamic OG image and include it in the `buildOgHtml()` call. Cache generated images (store in R2, key by URL hash) to avoid regenerating on every request.

- [ ] **Step 2: Add verse text for verse OG cards**

Bundle `data/quran.json` (or a minimal verse-text-only version) into the backend for server-side Arabic text rendering in verse OG cards.

- [ ] **Step 3: Test all OG cards**

Verify each link type produces a valid preview by checking:
```bash
curl -A "WhatsApp" "https://app.thebayaan.com/share/reciter/abdulbasit-abdulsamad"
```

Expected: HTML with `og:image` pointing to a generated PNG.

- [ ] **Step 4: Commit**

```bash
git add src/routes/share/index.ts src/lib/ogTemplate.ts src/lib/ogImage.ts
git commit -m "feat: dynamic OG card images for all share link types"
```
