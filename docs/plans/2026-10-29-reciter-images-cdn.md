# Reciter photos from the CDN

Status: proposed, revised after review · 2026-10-29

## Why

Reciter photos ship inside the app: 219 files, 16.6 MB, some single PNGs over
2 MB. The app finds them by display name (`utils/reciterImageLookup.ts`), so
renaming a reciter loses his photo, and every new or corrected photo waits for
an app release. About 120 reciters are being added now.

The backend already has `reciters.image_url` (the app prefers it over the
bundled file, `components/ReciterImage.tsx:69`) and presigned photo uploads
with a new key per upload (`bayaan-backend/src/services/uploadService.ts`).

What is missing: one size for every screen, nothing to show while a photo
loads, a single writer for photo fields, and edge caching (see below).

## Goal

The backend is the single source of truth for reciter photos. A new or fixed
photo reaches users within minutes, without an app release. Lists stay fast on
slow networks, and the app looks right offline.

## Design

### One photo model

A reciter's photo is one upload. The database stores what was uploaded, and
the API derives everything else, so the parts can never describe different
photos:

- `image_url` (existing column): the 512 px file of the latest upload. It keeps
  its meaning, so app versions already in the wild keep working.
- `image_placeholder` (new column): the ThumbHash of that upload (base64, at
  most 64 characters).
- The thumb is not stored. An upload made through the new flow has keys
  `assets/reciter-images/{slug}-{stamp}.webp` and
  `assets/reciter-images/{slug}-{stamp}-160.webp`, so the thumb URL is derived
  from `image_url`. For older photos it is `null`.

Public reciter responses add one object, built in `toPublicReciter`:

```json
"photo": { "full": "…-k3x9a1.webp", "thumb": "…-k3x9a1-160.webp", "placeholder": "1QcSHQRnh493V4dIh4eXh1h4kJUI" }
```

`photo` is `null` when there is no `image_url`; `thumb` and `placeholder` are
`null` for photos uploaded before this change.

### Only the upload endpoint writes photos

- `image_url` is removed from `CreateReciterSchema` / `UpdateReciterSchema`, so
  `PUT /admin/reciters/:id` can no longer change it. The only writer is
  `POST /admin/uploads/reciter-image/complete`, which sets `image_url` and
  `image_placeholder` together in one audited update.
- A new `DELETE /admin/uploads/reciter-image/:reciter_id` clears both, for
  removing a wrong photo.
- `scripts/upload-reciter-images.ts` (the old R2-key uploader writing fixed
  keys) is deleted.

### One upload mode

- `start` takes `reciter_id` only and returns the full-size target at the top
  level (`key`, `upload_url`, `headers`, as today) plus a `thumb` object with
  its own `key` and `upload_url`. Both are `image/webp`.
- `complete` takes `reciter_id`, `key` and `placeholder`. It derives the thumb
  key from `key`, checks both files (type, size, ownership by slug) in
  parallel, deletes them if either is bad, and then makes the single update.
- JPEG and PNG uploads are no longer accepted. Every caller produces the two
  WebP files and the placeholder with one shared helper (below). The only
  callers today are internal: the backfill script and the admin tools.

### Making the variants

`scripts/lib/photoVariants.ts` (Bayaan) exports a pure
`makeVariants(buffer) → { full, thumb, placeholder }`: centre square crop,
512 px and 160 px WebP at quality 80 with `sharp`, and a ThumbHash computed
from a 100 px copy with `thumbhash`. The admin dashboard can port the same
steps to a canvas when it gets photo uploads.

### Edge caching

`cdn.thebayaan.com` responses currently show `cf-cache-status: DYNAMIC`, for
photos and audio alike: Cloudflare is not caching them at the edge, so every
request goes to R2. Add a Cache Rule for `cdn.thebayaan.com` (cache
everything, respect origin `Cache-Control`). Objects already carry
`public, max-age=31536000, immutable` where the uploader set it; for new photo
uploads the `start` response includes that header for the client to send, and
`complete` does not depend on it. Removed or replaced files are purged as part
of the change that removes them (already our practice).

### Backfill

`scripts/migrate-reciter-images.ts` (Bayaan):

1. Reads every reciter through the admin API.
2. Source: the current `image_url` if set, else the bundled photo. It never
   re-encodes a file it produced itself (`-160` or stamped `.webp` sources are
   skipped).
3. `makeVariants`, then `start` → two PUTs → `complete`. Needs only the admin
   login.
4. `--dry-run` writes the variants and a contact sheet locally and changes
   nothing. `--only <slug,…>` limits the run. Reciters that already have a
   placeholder are skipped, so reruns after a failure are safe.

**Who gets backfilled when.** Setting `image_url` makes older app versions stop
using their bundled photo, and offline with a cold cache they would show the
plain icon. So the script leaves reciters with a bundled photo alone unless
`--force` is given:

- Now: `--no-bundled` (all new reciters and those missing a photo). Wrong
  bundled photos are fixed in the bundle (thebayaan/Bayaan#461).
- After the new app version reaches most users: `--all --force`.

### App (Bayaan)

- One resolver, `reciterPhoto(reciter, size)`, returning `{ uri?, placeholder?,
  bundled? }`, used by every place that shows a reciter photo today:
  `ReciterImage`, `utils/artworkUtils.ts` (player and lock screen),
  `services/car/CarSnapshotService.ts`, `BrowseReciters` (has-photo filter) and
  `ScrollingReciters`.
- `ReciterImage` takes `reciter` (or `photo`) and `size` (`thumb` | `full`)
  instead of `imageUrl`. Lists use `thumb`; profile, player and hero use `full`
  with the thumb as placeholder. `expo-image` with `cachePolicy="memory-disk"`,
  `recyclingKey={reciter.id}` and `placeholder={{ thumbhash }}`.
- Player tracks carry `reciterId` instead of an artwork string, so the player
  can use the same resolver.
- Order: the requested size, then the bundled copy, then the existing
  `ProfileIcon` (the car keeps its monogram).
- Bundled photos become 96 px WebP copies named by reciter id, generated next to
  the fallback catalogue. `utils/reciterImageLookup.ts`, its alias table and the
  generated `utils/reciterImages.ts` are deleted.
- No prefetch job and no separate copy saved with downloads: thumbs are
  5–10 KB, the placeholder covers loading, and expo-image's disk cache keeps
  what was seen.

### Rollout

1. **Backend:** migration, `photo` in responses, upload changes, the delete
   route, tests. Add the Cache Rule.
2. **Backfill, first group** (reciters without a bundled photo, and wrong
   ones). Dry run and contact sheet first.
3. **App release:** resolver, sizes, placeholder, id-named bundled thumbs.
4. **Backfill, everyone else**, once the new app is on most devices.

### Risks

- A wrong photo goes live for every user at once. The picker, the dry-run
  contact sheet and the audit log (revert) are the guards.
- Older app versions show the 512 px file in lists for backfilled reciters.
  Still smaller than most bundled originals.
- Older app versions offline with a cold cache show the plain icon for
  backfilled reciters. This is why the backfill is split in two.

## Tests

`tests/integration/routes/admin.uploads.test.ts`:

- `complete` sets `image_url` and `image_placeholder` in one audited update.
- `complete` refuses a missing thumb, a thumb or key for another reciter, and a
  placeholder that is too long or not base64.
- `PUT /admin/reciters/:id` with `image_url` is refused.
- `photo` is built correctly for a new-style upload, an old photo and no photo.
- `DELETE` clears both fields.

## Out of scope

Photos for rewayat or surahs, and dashboard photo uploads.
