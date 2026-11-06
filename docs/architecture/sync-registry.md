# Sync registry

This is the list of everything Bayaan keeps on a device and whether it follows
the user to their other devices. Every persisted Zustand store and every SQLite
table must appear here, either as **synced** or as **device-only** with a
reason. `services/library/__tests__/syncRegistry.test.ts` fails when a store or
table is missing, so a new one can't ship unclassified.

**The rule:** adding a syncable feature or setting, or changing the shape or
meaning of one that already syncs, always needs a sync or migration update in
the same change. Follow [Adding or changing synced data](#adding-or-changing-synced-data)
below and update this file.

All sync goes through bayaan-backend (the BFF). The app holds only an opaque
Bayaan session, never Quran Foundation (QF) tokens. Sync runs only while a
user is signed in to their QF account and the QF sync flag is on. The
lifecycle in `services/sync/qfSyncLifecycle.ts` runs, in order: `/v1/sync`
push and pull, highlights, library collections, then the installed content
list. Settings have their own lifecycle in
`services/settings/qfSettingsSyncLifecycle.ts`.

## Synced

### Settings (QF App State `settings` collection and QF Preferences)

The field-level allowlist is `services/settings/qfSettingsSnapshot.ts`. A field
added to one of these stores does **not** sync until it is added there and to
the BFF allowlist. See [qf-settings-sync.md](qf-settings-sync.md) for the merge
and conflict rules.

| Local source | Synced fields go to | Notes |
| --- | --- | --- |
| `store/themeStore.ts` | `settings/appearance` | `themeMode` |
| `store/mushafSettingsStore.ts` | `settings/mushaf`, Preferences | Reading layout, fonts, themes, rewayah, translation. Quran and translation font scales and Tajweed go to Preferences. |
| `store/tafseerStore.ts` | Preferences | Selected tafsirs. Downloaded tafsirs are listed in `settings/content`. |
| `store/reciterStore.ts` | `settings/audio` | Default reciter |
| `hooks/useSettings.ts` | `settings/audio`, `settings/browsing` | Reciter choice rules and browse view and sort options |
| `store/mushafPlayerStore.ts` | `settings/audio`, Preferences | Mushaf reciter and repeat counts. Playback rate goes to Preferences. |
| `services/player/store/playerStore.ts` | `settings/audio` | Only `repeatMode`, `shuffle` and `skipSilence`. The queue, position and sleep timer stay on the device. |
| `store/ambientStore.ts` | `settings/audio` | Ambient sound and volume |
| `store/adhkarSettingsStore.ts` | `settings/adhkar` | Adhkar display and font sizes |

BFF allowlist: `src/routes/v1/qfSettings.ts` in bayaan-backend.

### Installed translations and tafsirs (`settings/content`)

| Local source | Document | Merge |
| --- | --- | --- |
| `translation_metadata`, `tafseer_metadata` (downloaded editions) | `settings/content`: `{translations: [id], tafsirs: [id]}` | Union. Each device adds what it has; removing an edition on one device doesn't remove it elsewhere. A device offers each missing edition once per account, and only the list syncs, never the text. |

Code: `services/library/qfInstalledContentSync.ts`. BFF allowlist:
`src/routes/v1/qfSettings.ts` (`content` key).

### Library (QF App State `library`, `playlists`, `adhkar` collections)

Each document is three-way merged per item against the copy last synced, the
same model as highlights: a side that didn't change an item takes the other
side's value, and when both changed it this device wins. Code:
`services/library/qfLibrarySync.ts`, adapters in
`services/library/qfLibraryAdapters.ts`, wire shapes in
`services/library/qfLibraryDocuments.ts`. BFF allowlist:
`src/routes/v1/qfLibraryDocuments.ts`.

| Local source | Document | Shape | Notes |
| --- | --- | --- | --- |
| `services/player/store/favoriteRecitersStore.ts` | `library/reciters` | `{v: [[reciterId, favoritedAt]]}` | Up to 500 |
| `services/player/store/lovedStore.ts` | `library/loved-1` … `library/loved-114` | `{v: [[reciterId, rewayatId, lovedAt]]}` | One document per surah, to stay under 16 KB. A reciter's rewayat are told apart by `rewayatId` (`""` when none). Tracks of uploaded recitations stay on the device. |
| `user_playlists`, `playlist_items` | `playlists/<playlistId>` | `{name, color, description, createdAt, items: [[surah, reciterId, rewayatId]]}` | Fields merge one by one; the item list is one field, so the last edit to order or contents wins. An edit wins over a delete. Uploaded items stay on the device and keep their place after synced items. |
| `dhikr_favorites` | `adhkar/saved` | `{v: [[dhikrId, savedAt]]}` | Up to 2,000 |

On explicit sign-out, items that are exactly as last synced are removed from
the device (QF has them), and edited or never-synced items stay. Before a
different account syncs, the previous account's leftover synced items are
removed first so they aren't merged into the new account.

### Bookmarks, notes and reading progress (QF `/v1/sync`)

| Local source | QF resource |
| --- | --- |
| `bookmarks` | `BOOKMARK`, `COLLECTION_BOOKMARK` |
| `notes` | `NOTE` |
| `qf_reading_locations` | `READING_SESSION` |

Code: `services/sync/qfSyncCoordinator.ts` and
`services/sync/qfSyncResourceMapper.ts`. See
[qf-annotation-sync.md](qf-annotation-sync.md). BFF: `src/routes/v1/qfSync.ts`.

### Highlights (QF App State `highlights` collection)

| Local source | Document |
| --- | --- |
| `highlights` | `highlights/<surah>`: `{v: [[ayah, color, rewayah]]}` |

Code: `services/sync/qfHighlightSync.ts`. BFF: `src/routes/v1/qfSettings.ts`.

## Device-only

| Local source | Why it stays on the device |
| --- | --- |
| `services/player/store/recentlyPlayedStore.ts` | Listening history. "Continue on another device" is planned for later and will get its own document. |
| `store/playCountStore.ts` | Listening history |
| `services/player/store/downloadStore.ts` | Downloaded audio files exist only on this device |
| `store/analyticsConsentStore.ts` | Deliberately per device, so a new device's default can't override an opt-out made elsewhere |
| `store/devSettingsStore.ts` | Developer controls |
| `dhikr_counts` | Daily tasbeeh counts |
| `uploaded_recitations`, `custom_reciters` | Point at audio files on this device |
| `adhkar`, `adhkar_categories`, `adhkar_tags`, `category_tags`, `super_categories`, `adhkar_meta` | Bundled adhkar content |
| `translations`, `translation_footnotes`, `tafaseer`, `translation_metadata`, `tafseer_metadata`, `schema_version` | Downloaded text and its metadata. Only the list of editions syncs (see above). |
| `ayah_timestamps`, `cached_surahs` | Audio timing cache |
| `content_local`, `content_state` | Installed content packs and the state of the content manifest check |
| `schema_migrations` | Database bookkeeping |
| `qf_sync_state`, `qf_sync_outbox`, `qf_sync_payload_blocks`, `qf_guest_imports`, `qf_note_conflicts`, `qf_highlight_sync` | Sync bookkeeping |

Sync bookkeeping in AsyncStorage (`qf-library-sync-v1:*`,
`qf-content-offered-v1:*`, and the settings metadata) is per account and never
synced.

## Adding or changing synced data

Do these in the same change as the feature.

1. **Classify it.** Is it something the user would expect on their other
   devices (a preference, a list they built, something they saved)? Then it
   syncs. History, caches, downloads, files, counters, developer controls and
   transient UI state stay on the device. Add it to the right table above.
2. **Pick the home.** A setting goes in an existing `settings/*` document, or a
   QF Preference if QF has a lossless one. A user-built list goes in a library
   collection. Bookmarks, notes and reading progress use `/v1/sync`. Keep each
   document under 16 KB (shard by surah, as loved tracks do) and the account
   under 256 KiB in total.
3. **Ship the BFF allowlist first.** The BFF rejects unknown fields and
   collections, so the backend change must be live before an app version that
   writes the new field. Reads ignore fields the BFF doesn't know.
4. **Get QF approval for a new collection.** QF enables App State collections
   per client. Ask Osman to ask Basit to approve it on pre-live and production.
   Until then the app skips it: the lifecycle checks `app-state:config` and
   reports the collection as unavailable instead of failing.
5. **Changing an existing shape needs a migration.** Never reinterpret an
   existing field. Either add a new optional field that older versions ignore,
   or bump the document's `schemaVersion`. Older apps then see the document as
   read-only and must not write it back. Migrate local data the old app stored
   (a Zustand `version` and `migrate`, or a SQLite migration in
   `services/database/migrations/`) so existing users keep their data.
6. **Merge, sign-out and accounts.** Decide how two devices' edits merge (per
   field, per item, union) and write it here. Remove synced copies on explicit
   sign-out and keep unsynced ones. Make sure another account's data on the
   same device is not uploaded into this account.
7. **Tests.** Add codec tests, a two-device convergence test like
   `services/library/__tests__/qfLibrarySync.test.ts`, and BFF route tests for
   the allowlist (accept the new shape, reject anything outside it).
8. **Update this file and the BFF docs** (`docs/testing/qf-prelive-settings-sync.md`
   in bayaan-backend), and tick the sync box in the pull request template.
