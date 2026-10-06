# Regression and Verification Strategy for the QF Integration

| Field | Value |
|---|---|
| Status | Approved direction (2026-10-07), details for review |
| Scope | Everything shipping for the Quran.Foundation connected-app work: backend #24 (QF user sync BFF), backend #25 (content sync), mobile #320 (QF sign-in + user sync), the mobile content-sync plan (tafsir on the engine), and later sub-project C |
| Decisions | Staging environment: yes. Device testing tool: Argent (local simulators and emulators). Order: Phase 0 testing work before executing the mobile content-sync plan |

## 1. Why this exists

Every PR in this program is green on its own unit tests. The failures that would hurt users live between those suites:

| # | Risk | Why unit tests miss it | Blast radius |
|---|---|---|---|
| R1 | On-device migrations (#320 `userSyncV1`, the tafsir legacy migration, the new `content.db`) | They run for every user regardless of feature flags, against databases written by older app versions; tests only see fresh fakes | Bookmarks, notes, highlights, downloads; irreversible |
| R2 | Backend and mobile contract drift | Each side tests against its own idea of the manifest, envelope, and sync payloads | Silent purges or permanently failing updates |
| R3 | Real QF payloads vs our assumptions | Tests use synthetic payloads (example: #24 asserted weak ETags must be rejected, contradicting QF's spec) | Sync stalls for real users |
| R4 | Native layer | CI never compiles iOS or Android; #320 adds native modules; SDK 56 already broke native builds once (PR #294) | App fails to build or crashes at launch |
| R5 | Existing behavior being replaced | The tafsir pipeline changes source and storage; most current mobile behavior has no tests | Users see different or missing tafsir |
| R6 | Merge and deploy ordering | Backend #24 and #25 both claim migration indices 0003 and 0004 in the Drizzle journal; mobile depends on backend endpoints; #24 and #25 share the QF client | Broken deploy, missing API |

## 2. Layers

### Layer 1: Characterization tests (R5)
Pin today's behavior on `develop` before changing it. These tests must pass on `develop` now and after every change.
- Tafsir: `getTafseerForVerse` exact and nearest-previous fallback, grouped verses (`from_ayah`/`to_ayah`), selection default `169`, delete reselection.
- Translation lookup: bundled Saheeh and Clear Quran rendering, remote translation fallback to Saheeh, footnote extraction for bundled Saheeh.
- Startup: the AppInitializer services that touch content run in the expected order and tolerate failure.
- **Ibn Kathir parity:** an opt-in local check that fetches the production QF snapshot for tafsir 169, runs it through the new parser, and diffs row by row against what the bundled `ibn-kathir-tafseer-compact.json` produces through today's import. The diff must be empty or every difference explained. QF content is fetched fresh at run time and never committed (QF terms: no caching beyond a week, no prepackaging).

### Layer 2: Upgrade-path migration tests on real old databases (R1)
- Generate golden databases by running the **release code** of the database services (`v2.3.0`, the current store version, and `v2.2.1`) under Node with an `expo-sqlite`-compatible adapter backed by real SQLite (`better-sqlite3`). Populate realistic data: bookmarks (all rewayah IDs including `al-bazzi`, `shubah`, `qunbul`), notes with long and Unicode bodies, highlights, playlists, adhkar progress, downloaded translations, the imported Ibn Kathir, a second downloaded tafsir.
- Commit the resulting `.db` files as fixtures (they contain only synthetic user data and Bayaan-generated rows; tafsir rows are replaced by short synthetic text so no QF content is committed).
- Migration tests copy a golden database, run the new code's migrations through the same adapter, and assert: row counts preserved, every field preserved or mapped as documented, rewayah IDs canonical, idempotent on a second run, no new failure on an already-migrated database.
- One sanity capture from a real simulator via Argent (install a `v2.3.0` build, create data by hand, pull the SQLite files from the app container) to confirm the generated fixtures match a real device's schema.
- Applies to #320's `userSyncV1` and to the mobile content-sync legacy tafsir migration.

### Layer 3: Shared contract fixtures (R2, R3)
- `contracts/content/v1/` in both repos holds `manifest.json`, `manifest-withdrawn.json`, `download-ticket.json`, `envelope-translation.json`, `envelope-tafsir.json`, all produced by the backend's real code paths in a test, with QF snapshot records trimmed and replaced by synthetic text in QF's real shape.
- Backend test regenerates them and fails if they differ from the committed copy (explicit update step on intentional change).
- Mobile tests load the same files: `isManifest` accepts them, the engine applies them, the tafsir parser parses the envelope.
- A small check script (`scripts/check-contracts.sh` in the mobile repo) diffs the mobile copy against the backend repo's copy at a given ref; run in PR review whenever either side touches the contract.
- Real QF shapes: the snapshot record shapes in fixtures follow the production samples recorded in spec 11a (fields, footnote markup, empty continuation rows).

### Layer 4: Staging environment (R2, R3, R6)
- Railway `staging` environment for the backend: its own Postgres, its own private R2 bucket (`bayaan-content-staging`), the `content-sync` cron against **production** QF (pre-live data is too thin), `CONTENT_ADMIN_QA_ENABLED=true`.
- Host: `api-staging.thebayaan.com`; register `https://api-staging.thebayaan.com/v1/qf/auth/callback` on the QF production client for user sync.
- Before any release that touches this program, run on staging: first bootstrap, `scripts/content-smoke.ts --r2`, QA withdraw then restore, and (for #320) sign-in plus sync with two QF test accounts.
- Mobile dev builds point `EXPO_PUBLIC_BAYAAN_API_URL` at staging.

### Layer 5: Device end-to-end with Argent (R1, R4, R5)
Argent drives local iOS simulators and Android emulators. Each critical flow is recorded once as an Argent flow and replayed before every release candidate, on both platforms:
1. Fresh install: Ibn Kathir auto-installs; tafsir sheet opens with grouped verses.
2. Upgrade: install the `v2.3.0` build, create data, install the candidate over it; all data present; tafsir replaced from QF (log `content_update_applied`).
3. Offline launch: airplane mode; nothing purged; tafsir still opens.
4. Kill mid-update: force-quit during a tafsir download; old copy works on relaunch; update completes later.
5. Withdrawal: staging QA withdraw; content removed, fallback selected, one notice; restore afterwards.
6. (#320) Sign-in, add bookmark and note, second simulator signs into the same account and sees them; sign-out clears account data.
7. Smoke of unrelated core flows: play a surah, mushaf page turn, adhkar counter, playlist (catch accidental breakage).
iOS is mandatory: no iOS validation has happened so far in this program.

### Layer 6: CI gates (R4, R1, R2)
- New mobile workflow `native-build.yml`: Android `assembleDebug` on every PR touching native config, dependencies, or `app.config.js`; iOS simulator build nightly and on release branches (macOS runner).
- Required checks: Layer 1 characterization tests, Layer 2 migration tests, Layer 3 contract tests run inside the existing Jest and Bun suites (no extra workflow).

### Layer 7: Rollout, monitoring, and kill switches
- Order: internal TestFlight plus Play internal testing, then external testers, then App Store phased release (7 days) and Play staged rollout.
- Go/no-go for each step:
  - Crash-free sessions do not drop more than 0.3 points versus the previous release.
  - `content_update_failed` is under 2% of `content_update_applied` plus `content_update_failed` over 24 hours.
  - The content-sync Sentry cron monitor stays healthy, with no holds left unexplained.
  - No Sentry issue tagged with migration code.
- Kill switches, each with a runbook entry (who flips it, how, what users see):
  - `CONTENT_SYNC_PAUSED=true` on the API: devices freeze in place (no updates, no purges).
  - `QF_USER_SYNC_ENABLED=false` on the API, plus the app flag: user sync off.
  - Halting the phased release in App Store Connect and the Play Console.

## 3. Merge and deploy order (R6)
1. Backend #24 merges first (after the weak-ETag fix).
2. Backend #25 rebases onto it; its migrations are regenerated as 0005 to 0007 (Drizzle journal order), and its config keeps sharing `QF_CLIENT_ID`/`QF_CLIENT_SECRET`/`QF_OAUTH_BASE_URL`.
3. Both deploy to staging; Layer 4 checks pass.
4. Mobile #320 merges (after Layer 2 migration tests cover `userSyncV1`).
5. Mobile content-sync PR merges (after Phases 0 and 1 of its plan).
6. Release via Layer 7.

## 4. What each PR must show before merge
| PR | Required evidence |
|---|---|
| Backend #24 | Unit and integration suites; staging sign-in with two QF test accounts; weak ETag round-trip test |
| Backend #25 | Unit and integration suites; contract fixtures generated; staging bootstrap plus `--r2` smoke |
| Mobile #320 | Jest; Layer 2 golden migration tests for `userSyncV1`; Android native build; Argent flows 2, 6, 7 on iOS and Android |
| Mobile content-sync | Jest; Layer 1 characterization and Ibn Kathir parity; Layer 2 tafsir migration on golden DBs; Layer 3 contract tests; Argent flows 1 to 5 and 7 on iOS and Android |

## 5. Owners and open items
| Item | Owner |
|---|---|
| Create Railway `staging` environment and `api-staging.thebayaan.com`; create `bayaan-content-staging` R2 bucket and tokens | Osman |
| Second approved QF test account | Mostafa (requested) |
| A `v2.3.0` simulator build for upgrade tests (built locally from the tag) | Claude |
| Everything else in Layers 1 to 3, 5, 6 | Claude, via the Phase 0 plan |
