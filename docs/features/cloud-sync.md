# Feature: Cloud Sync & Cross-Device Data Sharing

**Status:** Planned
**Priority:** Medium
**Complexity:** High
**Created:** 2026-02-20
**GitHub Issue:** [#120](https://github.com/thebayaan/Bayaan/issues/120)
**Related:** [Shareable Deep Links (#117)](https://github.com/thebayaan/Bayaan/issues/117), [`docs/features/shareable-links.md`](shareable-links.md)

## Overview

Allow users to sync their personal data (playlists, bookmarks, notes, highlights, favorites, settings, uploads) across devices — and optionally share content with other users. This feature explores multiple approaches ranging from zero-auth native cloud (iCloud/Google Drive) to full Supabase-backed sync with user accounts.

## User Stories

- As a user with multiple devices, I want my playlists and bookmarks to appear on all of them without manual transfer.
- As a user who switches phones, I want my notes, highlights, and settings to carry over automatically.
- As a user, I want to share a playlist or uploaded recitation with a friend so they can listen to it.
- As a user, I want my data to be safe in the cloud so I don't lose it if I lose my phone.

## Local Data Inventory

| Data | Current Storage | Sync Priority | Notes |
|------|----------------|---------------|-------|
| Playlists + items | SQLite | High | Core user content |
| Verse annotations (bookmarks, notes, highlights) | SQLite (VerseAnnotationService) | High | Personal study data |
| Uploads (user-imported audio) | File system (MP3s) | Medium | Large files, needs file sync |
| Favorite reciters | Zustand (in-memory) | Medium | Small structured data |
| Recent reciters/surahs | Zustand (persisted) | Low | Ephemeral, device-specific |
| Play counts | Zustand (persisted) | Low | Stats, nice-to-have |
| Settings (theme, mushaf, adhkar, ambient) | Zustand (persisted) | Low | Preferences |
| Downloads (cached recitations) | File system | None | Re-downloadable from source |

## Options (Increasing Complexity)

### Option 1: iCloud + Google Drive (No Auth, No Backend)

Use each platform's native cloud to sync a user's data across their own devices.

**iCloud (iOS):**
- CloudKit via `react-native-cloud-store` or a native module
- Private database scoped to the user's Apple ID
- CloudKit Assets for file sync (uploads), ~250MB per asset limit
- Automatic conflict resolution via record change tags

**Google Drive (Android):**
- Google Drive App Data folder (hidden, app-scoped)
- User taps "Sign in with Google" once (not traditional auth — no account on your side)
- Structured data as JSON files or SQLite snapshots
- Uploads as Drive files

**Auth required:** No — identity comes from the OS account.

**Pros:**
- Zero backend cost
- No user accounts to manage
- Privacy-friendly — data stays in user's cloud
- Works offline with eventual sync

**Cons:**
- No cross-platform sync (iCloud doesn't reach Android, vice versa)
- No sharing between users — private sync only
- Two completely different implementations to maintain
- iCloud has no React Native first-party support (native modules needed)
- Limited control over conflict resolution

### Option 2: iCloud/Google Drive for Sync + Supabase for Sharing (Hybrid)

Use native cloud for personal sync; push to Supabase when a user wants to share.

- Personal sync (bookmarks, settings, playlists): iCloud / Google Drive
- Sharing (playlist link, upload link): Supabase Storage + Edge Functions
- Uploads sharing: upload MP3 to Supabase Storage, generate shareable link

**Auth required:** No for personal sync. Sharing could work anonymously or with lightweight auth.

**Pros:** Free personal sync via native cloud, sharing via existing Supabase
**Cons:** Two sync systems to maintain, sharing is push-only

### Option 3: Supabase Auth + Supabase Sync (Recommended)

Use Supabase as the single cloud backend for all sync and sharing.

- **Auth:** Supabase Auth with Apple Sign-In + Google Sign-In providers (native, one-tap)
- **Structured data:** Playlists, bookmarks, notes, highlights → Supabase Postgres with Row Level Security
- **Uploads:** User-scoped Supabase Storage buckets
- **Sharing:** Data is already server-side — grant read access or generate a link
- **Ties directly into shareable deep links (#117)**

**Auth required:** Yes — one-tap Apple/Google sign-in.

**Pros:**
- Cross-platform sync (iPhone ↔ Android)
- Sharing is built-in — data already in the cloud
- Single implementation, one codebase
- Natural extension of existing Supabase usage
- RLS secures data per-user without custom middleware

**Cons:**
- Users must sign in (low friction with one-tap, but still a gate)
- Storage costs scale with users (especially uploads)
- Responsible for uptime, backups, data privacy
- Offline-first needs local-first + sync strategy (conflict resolution)

### Option 4: Local-First with CRDTs + Supabase (Future-Proof)

Use a local-first sync framework (PowerSync, ElectricSQL, or Triplit) on top of Supabase Postgres.

- Data lives locally in SQLite (already used), syncs to Supabase when online
- CRDTs / operational transforms handle merge conflicts automatically
- True offline-first — works without connectivity, syncs when available

**Auth required:** Yes — user identity needed for sync routing.

**Pros:**
- Preserves existing offline-first behavior
- Automatic conflict resolution
- Real-time sync across devices
- Built on existing SQLite + Supabase stack

**Cons:**
- Still requires Supabase Auth
- Additional dependency (sync SDK)
- Maturing ecosystem, not fully battle-tested on React Native

## Key Technical Considerations

- **Audio routing stays unchanged.** Syncing metadata (playlists, bookmarks) does not require routing audio through a backend. Audio continues streaming from Supabase Storage / mp3quran.net.
- **Uploads are the hardest part.** Syncing MP3 files across devices requires actual file transfer (~5-50MB per file). All other data is lightweight structured data.
- **Downloads should NOT be synced.** They're cached copies of publicly available audio and can be re-downloaded on any device.
- **Offline-first is critical.** The app works fully offline today. Any sync solution must preserve this — sync should be additive, not a requirement.
- **Conflict resolution matters for annotations.** If a user bookmarks a verse on one device and adds a note on another, both changes should merge, not overwrite.

## Relationship to Shareable Links (#117)

These features are complementary:
- **Shareable links** need server-side data to resolve (e.g., fetching a shared playlist by ID)
- **Cloud sync (Option 3/4)** puts that data server-side naturally
- If cloud sync is implemented with Supabase, shared playlist links from #117 become trivial — the playlist already exists in Postgres, just make it readable by the recipient

## Implementation Phases (assuming Option 3)

1. **Phase 1:** Supabase Auth integration (Apple Sign-In + Google Sign-In)
2. **Phase 2:** Schema design — user-scoped tables for playlists, annotations, favorites
3. **Phase 3:** Sync engine — local SQLite ↔ Supabase Postgres (bidirectional)
4. **Phase 4:** Upload sync — user-scoped Supabase Storage buckets
5. **Phase 5:** Sharing — read-access grants, ties into shareable links (#117)

## Files Likely Affected

- `app.config.js` — Auth provider config (Apple, Google entitlements)
- `services/database/DatabaseService.ts` — Sync layer on top of existing SQLite
- `services/auth/` — New auth service (Supabase Auth SDK)
- `store/` — Persisted stores may need sync-aware wrappers
- `services/playlist/PlaylistService.ts` — Read/write to Supabase in addition to local
- `services/verse-annotations/VerseAnnotationService.ts` — Same
- New: auth screens or one-tap sign-in flow
- New: sync status UI (syncing indicator, conflict resolution)

## Open Questions

- Is cross-platform sync (iPhone ↔ Android) a requirement, or is same-platform enough?
- Should sync be opt-in (user explicitly enables it) or automatic after sign-in?
- What's the upload storage budget per user? (Supabase Storage pricing)
- Should there be a free tier (sync metadata only) vs premium (sync uploads)?
- How should conflicts be resolved — last-write-wins, or merge?
