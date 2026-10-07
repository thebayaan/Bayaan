# Content Freshness Layer and QF Content Sync (Sub-projects A + B)

| Field   | Value                                                       |
| ------- | ----------------------------------------------------------- |
| Status  | Draft for review                                            |
| Date    | 2026-10-05                                                  |
| Author  | Osman Saeday (with Claude)                                  |
| Repos   | `thebayaan/bayaan-backend` (most of B, part of A), `thebayaan/Bayaan` (device side of A) |
| Related | RFC-007 (Branding), RFC-009 (content provider seams), RFC-010 (`catalogVersionPoll`), RFC-015 (timestamps CDN), QF user-sync PRs bayaan-backend#24 and Bayaan#320 |

## 1. Context

Bayaan is becoming a Quran.Foundation (QF) connected app. QF gates this on two things: user features through QF OAuth (in review in the PRs above), and moving content off unauthenticated QF endpoints. This spec covers the second.

Today:

- Non-bundled **tafsirs** download from unauthenticated `api.quran.com/api/v4`, looping `tafsirs/{id}/by_chapter/{chapter}` with pagination (about 190 requests per tafsir). This is the only runtime call to `api.quran.com` (`services/tafseer/QuranComTafsirProvider.ts`).
- Non-bundled **translations** download from AlQuranCloud (`api.alquran.cloud/v1/quran/{id}`).
- Downloads are stored in SQLite (`translations.db`, `tafaseer.db`) with only `downloaded_at` and `verse_count`. There is no version, checksum or source, so nothing can tell a device its copy is stale or withdrawn.
- The catalogs are static lists (`data/availableTranslations.ts`, 117 entries; `data/availableTafaseer.ts`, 20 entries).
- Saheeh International and Dr. Mustafa Khattab's The Clear Quran are bundled JSON. Ibn Kathir (169) is bundled and imported into SQLite on first launch.

QF's Developer Terms (last updated 2026-10-04) now require:

- "Content Sync is the only permitted path for obtaining and maintaining an offline copy" of any resource available through Content Sync.
- A next sync "at least every 7 days when connectivity to QF permits", applying all changes.
- No "prepackaged database or build-time bundle of QF Content". Font files and Mushaf images are exempt.
- "Serving QF Content from a Developer-controlled backend within the Application's end-user experience is not, by itself, redistribution."

QF (Basit Minhas) confirmed on 2026-10-06 that the architecture below is correct, that every translation and tafsir is available through Content Sync, that we should use production credentials for content sync (pre-live covers only surahs 1 and 2), and that there are currently no rate limits.

## 2. Goals

1. Zero unauthenticated QF calls from the shipped app.
2. Every translation and tafsir comes from QF Content Sync, maintained within QF's terms.
3. **One generic content freshness layer** for every content type. Devices always converge on the freshest version of anything we serve, and stale or withdrawn content is replaced or purged. QF content is the first source; Bayaan's own content (reciter catalog, R2 timestamps, home config) plugs in later.
4. Corrections and withdrawals reach devices within about a day, silently.

## 3. Decisions

| # | Decision |
|---|---|
| D1 | Scope is every translation and tafsir QF serves. Editions QF does not serve are **dropped**. AlQuranCloud is removed entirely. |
| D2 | Dr. Mustafa Khattab's The Clear Quran stays **bundled** as the default, always-available translation. QF does not serve it, so the no-prepackaging rule does not apply to it. Bundling it rests on Bayaan's own permission from the rights holder, which was given verbally. |
| D3 | Saheeh International and Ibn Kathir (169) are QF content and **stop being bundled**. Ibn Kathir (169) auto-installs on first launch. Saheeh becomes a normal download. |
| D4 | Devices sync **through the Bayaan backend**, never directly with QF. The QF client-credentials secret never ships in the app. |
| D5 | Architecture is **versioned snapshots plus manifest comparison** (Approach 1). Rejected: relaying QF's row-level change feed to devices (too much client complexity, QF-specific), and a pass-through proxy (every device download hits QF, and it cannot serve Bayaan's own content). |
| D6 | Updates apply **silently** in the background. Withdrawals apply automatically with a fallback and a one-time notice. |
| D7 | The backend stores QF snapshots **verbatim**, inside a thin Bayaan envelope. Devices parse QF's shape directly. QF's own `schema_version` drives compatibility. |
| D8 | The backend syncs QF **hourly**. Devices check **daily**, and always after 7 days. |

## 4. Non-goals

- Bayaan's own content on the freshness layer (reciter catalog, timestamps, home config). That is sub-project D. This spec only makes sure the layer is generic enough to take it.
- The mobile UI work to replace the static catalogs and the old providers in full (sub-project C). This spec defines the device engine and migration C builds on.
- Attribution UI and the connected-app listing declaration (sub-project E). This spec only carries the attribution data.
- Audio and timestamps from QF `chapter_recitations`. QF timings only match QF's own audio files, so that decision belongs with audio, in D.
- Word-by-word, `quran_core` and `mushafs` sync groups. They fit the same layer later.

## 5. Architecture overview

```
QF Content Sync (production)
   │  hourly: /resources/sync (sync_token) + /resources/snapshots/{group}/{id}
   ▼
Bayaan backend: content sync job (Railway cron)
   │  validate → wrap in envelope → gzip → R2 (private, content-addressed)
   │  bump version in Postgres registry (content_resources)
   ▼
Bayaan backend API
   │  GET /v1/content/manifest           (ETag / 304)
   │  GET /v1/content/resources/{key}/download → presigned R2 URL
   ▼
Device: contentSync engine
   │  daily manifest compare → download → verify sha256 → atomic install
   │  or purge + fallback + notice
   ▼
Per-kind installers → existing translations.db / tafaseer.db → existing readers
```

## 6. Backend (sub-project B and the server half of A)

### 6.1 Data model (one new Drizzle migration)

`content_resources`: one row per resource, any kind, any source.

| Column | Notes |
|---|---|
| `key` (PK) | `qf:translations:20`, `qf:tafsirs:169`. Future: `bayaan:reciters`, `bayaan:timestamps:{rewayat}` |
| `kind` | `translation` \| `tafsir` (extensible) |
| `source` | `qf` \| `bayaan` |
| `upstream_group`, `upstream_id` | `translations`, `20` |
| `version` | integer, bumped on every published change |
| `upstream_schema_version` | from the QF snapshot |
| `status` | `active` \| `withdrawn` \| `held` |
| `withdrawn_reason` | from QF `unavailable_reason` |
| `withdrawn_at` | used for the 90-day manifest window |
| `object_key`, `sha256`, `bytes`, `row_count` | the current published artifact |
| `meta` (jsonb) | name, author, language, direction, attribution |
| `pending_refetch` (bool), `last_error`, `updated_at` | |

`content_sync_state`: one row per source (`qf`): `sync_token`, `resources_filter`, `last_success_at`, `last_attempt_at`, `last_error`.

### 6.2 Storage

- New **private** R2 bucket `bayaan-content`. Keys: `content/{kind}/{upstream_id}/{sha256}.json.gz`.
- Content-addressed keys mean a new version never overwrites an object a device may be mid-download on.
- Objects are deleted 30 days after being superseded.
- Access uses Bun's built-in S3 client (`Bun.S3Client`) against R2, behind a small `ContentStorage` interface (`put`, `presign`, `delete`) so tests use an in-memory fake. No new dependency.

### 6.3 Envelope

```json
{
  "envelope": 1,
  "key": "qf:translations:20",
  "version": 7,
  "source": "qf",
  "fetched_at": "2026-10-05T12:00:00Z",
  "snapshot": { "resource_group": "translations", "resource_id": 20, "resource_content_id": 20,
                "schema_version": 1, "sync_sequence": 98234, "records": [ ... ] }
}
```

`snapshot` is QF's response verbatim (D7).

### 6.4 QF sync job

`bun run content:sync`, run by a separate Railway cron service every hour from the same repo.

1. Take a Postgres advisory lock. If another run holds it, exit.
2. Get a client-credentials token (`scope=content`) through `@quranjs/api/server`, using Bayaan's own production QF client (`QF_CLIENT_ID` / `QF_CLIENT_SECRET`, production host). Tokens last 3600s, so one per run.
3. Refresh display metadata from `/resources/translations` and `/resources/tafsirs` into `meta`. Snapshots do not carry names, authors or languages.
4. Sync:
   - First run: `bootstrap=true&resources=translations:*;tafsirs:*`.
   - Later runs: `sync_token` with the same canonical filter.
   - Follow `next_page_url` (relative path, prefixed with the production content base) until `has_more` is false.
5. Collect the set of touched resources across all pages:
   - `RESOURCE_CREATE`, `RESOURCE_INVALIDATE`, any `ROW_CREATE` / `ROW_UPDATE` / `ROW_DELETE`: mark for publish.
   - `RESOURCE_DELETE`: set `status = withdrawn`, record `withdrawn_reason` and `withdrawn_at`.
   - `RESOURCE_UPDATE`: no-op (QF documents it as a freshness marker).
6. Publish each marked resource: fetch the snapshot, validate (6.5), wrap, gzip, upload, then in one DB transaction bump `version` and update `object_key`, `sha256`, `bytes`, `row_count`, `upstream_schema_version`, `status = active`. A failure sets `pending_refetch = true` and does not block the rest.
7. Store the final `next_sync_token`, but only after step 6 has been attempted for every marked resource. Snapshots are current-at-fetch, so a later refetch of a `pending_refetch` resource is still correct.
8. Retry every `pending_refetch` resource on each run.
9. On `resync_required` or `token_filter_mismatch`: bootstrap again. Any active resource absent from the bootstrap set becomes `withdrawn` with reason `absent_from_bootstrap`.

Row-level QF changes become a full republish of that one resource (a few MB on Wi-Fi). Devices never apply rows.

### 6.5 Validation before publish

- `records` non-empty and `schema_version` is one the backend knows. An unknown version sets `status = held`.
- Translations: verse keys unique and valid, full coverage of 6,236 verses.
- Tafsirs: `start_verse_id <= end_verse_id`, ranges valid and ordered.
- **Drop guard:** if `row_count` falls more than 5% compared with the current published version, set `status = held`, keep serving the previous artifact, and alert. A human releases or rejects it through the admin endpoint.
- An explicit `RESOURCE_DELETE` is never held.

### 6.6 Device API

All routes use the existing Bayaan API key (`Authorization: Bearer`), so guests work. Responses use `Cache-Control: no-store` except where noted.

**`GET /v1/content/manifest?kinds=translation,tafsir`**

```json
{ "format": 1, "generated_at": "2026-10-05T12:00:00Z", "paused": false,
  "resources": [
    { "key": "qf:translations:20", "kind": "translation", "source": "qf",
      "version": 7, "status": "active", "upstream_schema_version": 1,
      "bytes": 1840221, "sha256": "...",
      "meta": { "name": "Saheeh International", "author": "...", "language": "en",
                "direction": "ltr", "attribution": "Saheeh International, via Quran Foundation" } },
    { "key": "qf:tafsirs:93", "kind": "tafsir", "source": "qf", "version": 4,
      "status": "withdrawn", "withdrawn_reason": "copyright_holder_request" }
  ] }
```

- `ETag` is a hash of the body. `If-None-Match` returns `304`.
- `held` resources appear as their last good active version. A resource held on its first publish (no earlier good version) is omitted until released.
- Withdrawn entries stay listed for 90 days after `withdrawn_at`.
- `paused: true` is the kill switch: devices keep what they have and skip updates and purges.

**`GET /v1/content/resources/{key}/download`**

Returns `{ url, version, sha256, bytes, expires_at }`. `url` is a presigned R2 URL valid for 10 minutes, for the **current** version. Rate limited per API key and IP. Withdrawn or unknown keys return 404.

**Admin** (existing `adminAuth`):
- `GET /admin/content`
- `POST /admin/content/{key}/refetch`
- `POST /admin/content/{key}/release` (for held resources)
- `POST /admin/content/resync`
- Staging only: `POST /admin/content/{key}/withdraw` and `/restore`, for QA of the device purge flow.

## 7. Device engine (client half of A)

### 7.1 Structure

- `services/content/contentSync.ts`: generic engine. It knows manifests, versions, downloads and purges, and nothing about translations.
- Installers registered per kind, with this contract:

  ```ts
  interface ContentInstaller {
    kind: ContentKind;
    install(key: string, envelope: ContentEnvelope): Promise<void>; // one SQLite transaction
    remove(key: string): Promise<void>;
    onWithdrawn(key: string): Promise<WithdrawalNotice | null>;     // fallback handling
    supportsSchemaVersion(version: number): boolean;
  }
  ```

- `translation` installer: parses QF translation records into `translations.db`.
- `tafsir` installer: parses QF tafsir records (verse ranges) into `tafaseer.db` (`group_verse_key`, `from_ayah`, `to_ayah` already exist).
- Readers, lookups and the RFC-009 seams do not change in this spec. Sub-project C makes Bayaan's default providers read from the local store.

### 7.2 Local registry

New table `content_local` (`key` PK, `kind`, `version`, `sha256`, `upstream_schema_version`, `installed_at`, `last_checked_at`, `legacy` bool, `user_removed` bool). It is the source of truth for "what is installed at which version".

### 7.3 Check cadence

On app foreground, if the last successful check was more than 24 hours ago. Always, if it was more than 7 days ago. The manifest endpoint comes from a new optional branding slot `contentApiBase` (a base URL used for both manifest and download), defaulting to Bayaan's backend (RFC-007).

### 7.4 Comparing the manifest

Only on a successful `200` (a `304` means nothing changed):

| Manifest says | Device does |
|---|---|
| same version | nothing |
| newer version, schema supported | queue update |
| newer version, schema unsupported | keep current copy, flag "update requires app update" |
| `withdrawn`, or key absent from manifest | purge, then fallback and notice |
| `paused: true` | nothing |

Only resources the device has installed are updated. Nothing new installs automatically except Ibn Kathir (169) on first launch.

### 7.5 Applying updates

- One at a time, in the background.
- Updates over 5 MB wait for Wi-Fi unless the user allows cellular. Withdrawals apply immediately.
- Download to a temp file, verify `sha256`, then install inside **one SQLite transaction**, and only then bump `content_local.version`. Interrupted or failed installs leave the old copy intact.
- Per-resource backoff on failure: 1h, 6h, 24h.
- If storage is full, skip and keep the old copy.

### 7.6 Withdrawal fallback

- A withdrawn translation that is selected switches the selection to the bundled Clear Quran.
- A withdrawn tafsir that is selected switches to another installed tafsir, or the existing empty state.
- The **setting is updated**, which fixes today's silent fallback where `selectedTranslationId` keeps pointing at a missing edition.
- One-time notice: "*{name}* was withdrawn by its publisher via Quran Foundation."

### 7.7 First launch and migration

- **New installs:** Clear Quran is available immediately. On first launch with a connection, Ibn Kathir (169) auto-installs over any network. If the user removes it, `user_removed` is set and it never reinstalls automatically.
- **Existing installs (one-time migration):**
  - Every legacy download becomes a `content_local` row with `version = 0` and `legacy = true`, so it is replaced from QF on the first check.
  - Tafsir ids are already QF ids: `169` maps to `qf:tafsirs:169`.
  - Translations use a one-time crosswalk from AlQuranCloud identifiers to QF resource ids, built from the manifest and checked against the audit's 30 strong matches and 12 candidates. The crosswalk is a static table shipped with the migration.
  - Unmatched translations are purged with a notice (D1).
  - The bundled Ibn Kathir import (`importBundledIbnKathir` in `AppInitializer`) is removed. The already-imported copy becomes `version = 0` and is replaced from QF.
  - Bundled Saheeh is removed from the app. Users who selected it get it installed from QF on the first check. They are on Clear Quran until it lands.

**Delivery split (2026-10-06):** the tafsir half of this section ships with the first mobile plan (`docs/superpowers/plans/2026-10-06-content-sync-mobile.md`). The translation half (AlQuranCloud crosswalk, removing bundled Saheeh, QF footnote rendering, translation installer) ships with sub-project C, because installing translations from QF depends on C's picker, identifier and footnote work. Until C lands, translations keep downloading from AlQuranCloud (not a QF endpoint) and bundled Saheeh remains.

## 8. Error handling and monitoring

- **Backend sync:**
  - Token, network or QF 5xx: the run aborts without changes; next run retries.
  - QF 429: honor `Retry-After` and stop the run.
  - Per-resource snapshot failure: `pending_refetch`.
- **Device:**
  - Purges only after a successful `200` manifest. Errors, empty responses or an unreachable backend never delete anything, and the app keeps working offline.
  - SHA mismatch: discard and back off.
  - Corrupt local state: rebuilt by diffing against the manifest.
- **Monitoring:**
  - A Sentry cron monitor alerts if no sync has succeeded in 6 hours.
  - Alerts on any `held` resource and on `pending_refetch` older than 24 hours.
  - PostHog device events `content_update_applied`, `content_withdrawn`, `content_update_failed`, carrying keys and counts only.

## 9. Compliance

- Backend copies are maintained through Content Sync hourly. Device copies are updated within about a day of a backend change, and devices force a check after 7 days.
- No QF content is bundled in the app (D3). Clear Quran is not QF content (D2).
- Content is served only to Bayaan's own app through presigned URLs, which QF's terms do not count as redistribution. The bucket is private and not enumerable.
- Every manifest entry carries an attribution string for sub-project E.
- New content sources, scopes or monetization must be reported to QF before shipping (connected-app requirement).

## 10. Testing

- **Backend** (`bun test`, real Postgres, fake `ContentStorage`, QF stubbed with fixtures recorded from **production** responses):
  - Sync job:
    - Bootstrap.
    - Paginated pages, with the token stored only after the last page.
    - Row change: republish with version bump.
    - Invalidate: republish.
    - Delete: withdrawn.
    - `RESOURCE_UPDATE`: no-op.
    - `resync_required`: re-bootstrap, and absent resources become withdrawn.
    - Crash mid-run: safe repeat.
    - `pending_refetch` retried.
    - 5% drop: held, and released by admin.
    - Unknown `schema_version`: held.
    - Lease contention: second run exits.
  - API:
    - Manifest shape, `ETag` / `304`, the 90-day withdrawn window, `paused`.
    - Download presigns the current version; 404 for withdrawn.
    - Rate limiting; guest API key auth.
- **Production smoke runner** (manual, not CI): bootstrap one translation and one tafsir against production with Bayaan's own credentials, and assert the published artifacts parse.
- **Mobile** (`jest`):
  - Parsers against the same production fixtures: footnotes, HTML in tafsir text, multi-verse tafsir rows with `getTafseerForVerse`.
  - Engine:
    - Every row of the 7.4 table.
    - A failed manifest never purges.
    - SHA mismatch rejected.
    - Interrupted install keeps the old copy.
    - Wi-Fi gating.
    - 7-day forced check.
    - Backoff.
  - Migration:
    - Legacy rows replaced.
    - Crosswalk re-download.
    - Unmatched purge with notice.
    - Ibn Kathir first-launch install, and no reinstall after removal.
    - Selected Saheeh restored from QF.
- **Manual QA on iOS and Android** against a staging backend (syncing QF production content): first launch, airplane mode, kill mid-update, and a staged withdrawal through the admin endpoint showing purge, fallback and notice.
- Standard gates: `tsc --noEmit`, Prettier on changed files, existing CI.

## 11. Rollout

1. Backend: migration, storage, sync job and API behind `CONTENT_SYNC_ENABLED`. Run the bootstrap in production and inspect the registry and artifacts before any device uses them.
2. Mobile: engine, installers and migration behind a remote flag (the manifest's `paused` plus an app flag), shipped to TestFlight first.
3. Enable for everyone. Remove AlQuranCloud and `QuranComTafsirProvider` in sub-project C once the migration has run for most users.

## 11a. Observed QF responses (2026-10-06)

Fetched with Bayaan's own Developer Console clients. Pre-live and production are **separate clients** (different client IDs); each only authenticates against its own host.

**Auth (both environments):** `POST {oauth host}/oauth2/token` with HTTP Basic client authentication and `grant_type=client_credentials&scope=content` returns a token with `expires_in` 3599. Sending the secret in the form body is rejected (`invalid_client`).

**Production catalog:** 145 translations across 82 languages and 23 tafsirs in `/resources/translations` and `/resources/tafsirs`. Each entry: `{id, name, author_name, slug, language_name, translated_name: {name, language_name}}`. These lists are `Cache-Control: max-age=604800, public` with a weak ETag and carry no version or timestamps. A tafsir-only bootstrap returned **24** tafsir resources against 23 listed, so the registry must be driven by the sync feed, with the resource lists used only for display metadata.

**Sync filter gotcha:** an unencoded `resources=translations:*;tafsirs:*` returned only the 151 translation resources and **no tafsirs**. The URL-encoded, alphabetically ordered `tafsirs:*;translations:*` returned both groups (paginated, `per_page=100`). The job must build one canonical filter (groups sorted, then URL-encoded), store it in `content_sync_state.resources_filter`, and after bootstrap assert that every group in the filter produced at least one resource.

**Snapshots:** plain JSON, `Cache-Control: no-store`, weak ETag, no compression. Missing resources return 404 `snapshot_not_found`.

| Resource | Rows | Raw | Gzipped |
|---|---|---|---|
| Translation 20 (Saheeh International) | 6,236 | 3.65 MB | 0.60 MB |
| Tafsir 169 (Ibn Kathir, English) | 6,236 (4,340 empty continuation rows) | 12.39 MB | 3.61 MB |

So the first-launch Ibn Kathir install is about 3.6 MB on the wire, under the 5 MB Wi-Fi threshold (7.5).

**Translation records:** `id, resource_id, resource_content_id, verse_id, verse_key, chapter_id, verse_number, text, foot_notes, language_id, language_name, juz_number, hizb_number, rub_el_hizb_number, manzil_number, ruku_number, surah_ruku_number, page_number, updated_at`. Footnotes appear as **inline markup in `text`**, for example `In the name of Allāh,<sup foot_note=254011>1</sup> the Entirely Merciful...`, with the matching entries in `foot_notes`: `{id, translation_id, resource_content_id, language_id, language_name, text}` where `text` is HTML. In Saheeh, 1,613 of 6,236 rows carry footnotes. Translations previously came from AlQuranCloud without footnotes, so sub-project C must either render footnotes (as the bundled Clear Quran already does) or strip the `<sup>` markers. The translation installer stores `text` and `foot_notes` verbatim either way.

**Tafsir records:** the translation keys minus the language fields, plus `group_tafsir_id, group_verse_key_from, group_verse_key_to, group_verses_count, start_verse_id, end_verse_id`. Text is HTML and matches the currently bundled Ibn Kathir file, confirming that file is QF content (D3).

Every record carries `updated_at`, useful for diagnostics; versions remain Bayaan-assigned.

## 11b. Connected Apps listing declaration (QF guidance, 2026-10-06)

Mostafa Elkhanany (QF) confirmed what the listing needs: a clear provenance split between content sourced through Quran.Foundation and content Bayaan holds or licenses independently. It does not need to imply that all Quranic content comes from QF. Planned wording for sub-project E:

- **Quran.Foundation content:** translations and tafsirs sourced and maintained through QF Content Sync.
- **Other licensed content:** The Clear Quran by Dr. Mustafa Khattab, independently licensed and maintained by Bayaan.

The same split should be visible to users (credits screen and the per-edition attribution carried in the manifest `meta.attribution`).

**Found while preparing this:** `data/wbw/wbw-en.db` (bundled word-by-word data) was generated by `scripts/fetch-wbw-translations.js` from `api.quran.com`. It is QF content bundled into the app, which the 2026-10-04 terms do not allow. QF exposes it through the `word_by_word_translations` and `word_by_word_transliterations` sync groups, so it should move onto this layer as a follow-up (a new installer kind). Until then it cannot be declared as independently licensed content.

## 12. Open items

| Item | Owner |
|---|---|
| Create Bayaan's own production client in the QF Developer Console with all scopes, including `content` | Osman |
| Snapshot format, footnotes, sizes and catalog verified against production (see 11a). Done | |
| Content-source declaration and listing format: answered (see 11b) | Done |
| Move bundled word-by-word data (`data/wbw/wbw-en.db`, QF-derived) onto Content Sync | Follow-up after C |
| Optional: a short written confirmation (an email is enough) of the existing verbal permission to bundle The Clear Quran, since the listing declares it as independently licensed and QF removed it at the holder's request | Osman |
| Final crosswalk for the 12 candidate translations (content comparison) | Sub-project C |

## 13. Follow-on sub-projects

- **C.** Translations and tafsir fully on the layer: the manifest replaces the static catalogs, the old providers are removed, and the default RFC-009 providers read from the local store.
- **D.** Bayaan's own content on the layer: reciter catalog (replacing `DATA_VERSION`), R2 timestamps (finally revalidated), home config. Possibly QF `chapter_recitations` for reciters where we also switch to QF audio.
- **E.** Attribution and compliance UI: "Quran data provided by Quran Foundation", per-edition credits, content-source declaration.
