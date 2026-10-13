# QF annotation synchronization (pre-live)

The mobile client uses only the Bayaan BFF with an opaque, device-bound session.
SQLite rows, outbox entries, and stable pull heads belong to a single account.
This integration remains off by default; local fixture validation does not
replace native iOS/Android or two-device provider QA.

## Signed-out device storage

An explicit sign-out deletes the account's synced rows from the device, as
Quran.com web does (`useLogout` clears bookmarks and reading history to prevent
leakage on shared devices). Sign-out first asks the lifecycle to deliver queued
edits (bounded to five seconds), stops sync, revokes the session, then deletes
the account's bookmarks, notes, reading location, outbox, payload blocks, note
conflicts and stored head in one transaction. The next sign-in pulls the
account again from QF. Guest rows and the guest-import ledger (decisions and
counts only) stay.

Highlights are purged per surah, and only those exactly as last synced through
QF App State (see below), since Quran.com holds a copy of those. The rest (App
State off for the client, never online since signing in, a rejected document,
or edits not yet synced) stay, scoped to the account and hidden while signed
out, and merge back when it signs in again. Nothing is lost, so highlights do
not count toward the sign-out warning.

If edits are still queued after the flush window (e.g. signing out offline),
sign-out asks first ("N changes haven't synced to Quran.com yet and will be
lost"), with Cancel as the default; they are dropped only if the user confirms.
A revoked or expired session is not a sign-out and keeps the rows for that
account's return.

## Highlights through QF App State

QF has no highlight resource, so highlights use Bayaan's approved `highlights`
App State collection: one document per surah (key `"1"` to `"114"`), value
`{v: [[ayah, color, rewayah], ...]}` where `ayah` is the verse key without its
surah (`"255"`, or `"255:7"` for a split verse anchor). The BFF lists every
document (all pages) and writes one with its precondition; a document it cannot
write back (newer schema, unknown colour) is listed read-only and the app
leaves that surah alone.

Each annotation sync cycle, after its push, lists the documents and merges
each surah per verse against the copy last synced (`qf_highlight_sync`, added
by `user_sync_v5`): a side that left a verse unchanged takes the other side's
value, and when both changed the same verse this device wins. The merge is
written locally only if the surah still matches what was read (an edit
mid-sync waits for the next round), then to QF with `If-Match` (or
`If-None-Match: *` for a new document). A conflict (409, 412 or 428) leaves the
surah for a retry a second later; an uncertain write needs no replay because
the next round's merge converges. A document refused on its own (e.g. a 400)
skips that surah and the others continue. Signed-in highlight edits request a
sync. App State being off for the client (403 or disabled) skips highlights
without failing sync.

## Reading credited to QF activity days

Mushaf reading counts toward the user's Quran.com streaks through QF activity
days (`POST /v1/activity-days`, `type: QURAN`, behind the optional
`activity_day` scope). `qfActivityDayTracker` times the pages on screen (both
pages of a facing spread) while the app is active, ignoring a page shown for
less than 3 seconds and anything past 10 minutes on one page. Reading is
queued in MMKV per account as batches of the device's local date, timezone,
seconds and merged verse ranges (Hafs keys, one surah per range), sent through
the BFF with `mushafId` 4 every 30 seconds, when the app leaves the foreground
and when the reader closes. A batch is sealed before its first send, so a retry
resends it unchanged with the same `Idempotency-Key` while later reading starts
a new batch. Server errors back off (up to 15 minutes); a refused batch is
dropped; a 403 pauses sending until the next launch or sign-in and keeps the
queue. Batches older than six days expire. Sign-out sends what it can within
the existing wait, then clears the account's queue. The resume location stays
on `READING_SESSION`.

## Guest decisions cover rows, not an account's lifetime

Guest-import consent applies to the offered rows. A prior merge does not silently
import future signed-out drafts. A keep-separate decision records account-scoped
row membership in the existing `qf_guest_imports` ledger; those rows remain guest
only and are not offered repeatedly. New guest bookmarks, notes, or highlights
are offered again, including when returning to the same account. Merging that
new batch excludes the rows previously kept separate. Copy, outbox enqueue,
row claiming, and the decision are atomic. Another account's decision cannot
suppress its own offer. Legacy decisions have no reliable batch-membership
proof, so remaining guest rows require explicit reconfirmation rather than an
automatic import. Editing an already kept-separate row does not revoke that
row's guest-only disposition.

## Transaction boundaries and view refresh

Pull-page application, stable-head commits, outbox changes and guest-import
claims use a private SQLite transaction connection. Native platforms use Expo's
exclusive transaction callback handle; web opens a new connection to the same
database. All SQL and annotation helpers inside a transaction use that handle,
not the shared live-annotation connection. Lock failures surface as failures;
there is no fallback to a shared transaction that could silently roll back a
successful live write. This is rollback isolation, not a claim of unlimited
concurrent write availability.

The lifecycle refreshes every loaded surah after its initial pull, and again
after non-idle push/recovery completion, deferral, or failure. Push can pull
additional remote rows after a conflict or uncertain result. Those persisted
rows must update annotation sets and `dataRevision` even if later recovery does
not finish successfully. Account-epoch checks prevent an old cycle from
repopulating a newer account's active views.

## Bookmark projection and cursor meaning

QF supports `page`, `juz`, `surah`, and `ayah` bookmarks. Non-ayah bookmarks may
have no `verseNumber` or a null value. Bayaan currently represents only ayah
bookmarks. The official [bookmark schema](https://api-docs.quran.com/docs/user_related_apis_prelive/get-bookmark/)
and [Get mutations contract](https://api-docs.quran.com/docs/user_related_apis_prelive/get-mutations/)
document this distinction; Get mutations filters resources, not bookmark types.

On pull, the codec validates the envelope, identity, timestamp, and allowlisted
bookmark data before projecting out recognized non-ayah CREATE/UPDATE effects
and reading bookmarks (`isReading: true`, Quran.com's "where I stopped" marker).

**Bayaan bookmarks are Quran.com Favorites.** QF places every `/v1/sync` ayah
bookmark in Favorites (`isInDefaultCollection: true`), and Bayaan applies those
reads as ordinary bookmarks. A bookmark that leaves Favorites elsewhere
(`isInDefaultCollection: false`, not a reading bookmark) leaves Bayaan: the
backend forwards that GET read as a BOOKMARK tombstone, which devices apply
under the usual remote-id-only, stale and pending-intent guards. An absent flag
keeps the read as an ordinary bookmark.

**Deletes leave Favorites; QF decides the rest (issue #324).** Every pushed
bookmark delete is `{resource: "COLLECTION_BOOKMARK", type: "DELETE", data:
{collectionId: "__default__", bookmarkId}}` with no resourceId, as Quran.com
web removes Favorites (`useCollectionToggle.ts`). QF deletes the bookmark only
when no custom collection holds it and it is not the reading bookmark;
otherwise it only leaves Favorites. Bayaan keeps no membership table, so stale
local membership can never wipe a custom collection. The outbox row stays a
BOOKMARK DELETE; its receipt may carry the composite id `__default__-<id>`,
the identifier pair, or no identity, and must agree with the sent bookmark.

If the bookmark already left Favorites elsewhere (a delete queued offline),
QF rejects the whole push as not found (backend: `QF_SYNC_NOT_FOUND` 404). A
removal is therefore always pushed alone, and that 404 settles it: the intent
already holds. Pulled `COLLECTION_BOOKMARK` effects are not requested and are
ignored if they arrive.

It does not reinterpret a page number as an ayah, delete a local row merely
because its remote update is unsupported, enqueue a cloud write, or change the
provider bookmark. Unknown types, conflicting type aliases, malformed ayah
bookmarks, and malformed NOTE data still fail closed.

DELETE tombstones carry no bookmark type or verse coordinates. Keep them in the
projection and apply them only to matching account-local remote IDs, subject to
existing stale-timestamp and pending-intent guards. Unobserved IDs have no local
effect; they are not inferred to be ayah bookmarks.

Ordinary pulls require a present mutations array, including a genuine empty
array. Omitted, null or wrong-type arrays fail closed without advancing the
stored cursor. Only an explicitly requested metadata pull may be head-only;
present malformed fields and non-allowlisted fields still fail validation.

Repeated bookmark adds read the persisted row inside the same private/exclusive
transaction as INSERT OR IGNORE. Existing rows keep their operation identity,
backoff and uncertain delivery evidence; only newly inserted rows enqueue a
CREATE. Re-adding an unsent DELETE can cancel that delete, while uncertain
DELETE evidence is retained rather than destructively cleared.

Provider `page`, `limit`, `total`, and `hasMore` describe the unprojected stream.
They are never recomputed from the local effect count. An empty projected page
can have a continuation. Without explicit pagination, the received raw count
still prevents a full unsupported-only page from appearing to be a terminal
short page. Traverse every page, then recheck the provider metadata head before
committing the account cursor. A committed cursor means this supported local
projection is caught up, not that every provider resource has a local model.

## Unsupported unsent NOTE payloads and additive storage compatibility

Local note TEXT remains unrestricted and is never truncated. The existing
outbound codec supports up to 200,000 UTF-16 code units (JavaScript length);
200,001 cannot be sent. A typed local unsupported NOTE error records an
account-scoped reason and current revision in the additive
`qf_sync_payload_blocks` sidecar. No delivery enum or existing annotation/outbox
column changes. V3 creates the table, index and migration version atomically
using the private transaction handle. V1/V2 version guards remain unchanged.

Only UNSENT PENDING intent can be blocked. IN_FLIGHT/AMBIGUOUS rows and immutable
sent snapshots retain receipt recovery, never quota-driven reclassification or
blind CREATE replay. Reservation, conflict rebase and retry-status calculation
revalidate actual payload bytes in keyset chunks before trusting any marker. This includes old
writers that change bytes without updating revision, and old deletes followed
by operation-ID reuse. Markers are diagnostics, not authority to hide a row.
Blocked rows are excluded from retry-due calculation, not from retained intent
counts. Healthy neighbors beyond a blocked first chunk can still push. Supported
edits clear the marker atomically, retaining pending CREATE identity and keeping
remote-backed UPDATE intent as UPDATE. DELETE does not validate historical body.
Diagnostics contain reason counts only, not note text or payloads.

Guest merge validates before copying: unsupported notes keep the full guest
source, create no copy/claim evidence and return skipped reason counts. The
merge decision is not an import-finished flag. A later eligible edit is offered
and, with consent, copied exactly once. Keep-separate membership is unchanged.

Sandbox SQLite WASM fixtures exercise V1-to-V2-to-V3 upgrades and existing V2
pending/in-flight/ambiguous rows, repeated migration/reopen, unchanged columns,
IDs, content and sent evidence, plus published `432baa3` V1/V2 migration guards
and old SQL read/INSERT/UPDATE/DELETE contracts against the upgraded schema.
Older clients can ignore the sidecar; they do not retroactively gain these
features and retain their previous oversized-push behavior. This is tested SQL
compatibility, not a claim that every historical native binary was QA-tested.
No actual device database migration or native old/new application QA was run.

## Public NOTE pull projection and transient local locks

The pull codec validates NOTE identity, timestamp, field allowlist, body length,
1..100 bounded canonical verse ranges, optional source and boolean `saveToQR`
before omitting a valid public (`true`) CREATE/UPDATE local effect. Private
(`false`) notes remain projected; missing/nonboolean markers and malformed
public data fail closed. Public push ACKs/outbound public requests are rejected;
markerless DELETE identity semantics are unchanged. Pagination and raw received
cardinality still describe the original stream, including public-only pages;
metadata-head stability/CAS is required before cursor advancement. This is
mobile robustness, not evidence of a live provider/BFF bug (the BFF already
filters valid public notes).

Known SQLite BUSY/LOCKED codes and exact bounded Expo/WASM lock diagnostics are
converted to a typed transient error only at the local SQLite boundary, retaining
the original error as its cause. Source-controlled fixtures include the installed
Expo Android binding's exact BUSY/LOCKED control-character prefixes, raw and
wrapped; these fixtures are not native-device QA. Unknown errors and generic busy/locked wording remain permanent, and provider errors
retain their existing HTTP policy. The lifecycle retries a known lock after
exactly the existing 1,000 ms default delay without setting its permanent epoch
barrier; subsequent annotation triggers remain eligible. Logout, offline and
account-switch epoch guards cancel/ignore stale retries. The WASM ACK fixture injects BUSY/LOCKED during an ACK transaction after a
bookmark receipt, proves rollback retains the immutable IN_FLIGHT snapshot,
then exercises the lifecycle's 1,000 ms retry and existing stable-pull bookmark
identity recovery with exactly one provider push. NOTE sent-evidence fixtures
remain unchanged by blocking; this does not resolve ambiguous NOTE CREATE
receipt correlation (issue 323), add a receipt endpoint, or authorize blind
CREATE replay. The exclusive/private transaction implementation itself is
unchanged. Local fake-clock and WASM fixtures are not native-device QA.

## Bounded pages and recovery

SYNC GET responses are limited to 2 MiB on both the BFF and this client. A
supported 200,000-character note can expand
to 1.2 MB in JSON when control characters require six-byte escapes. If a pull
page exceeds the cap, the BFF returns HTTP 502 with the exact typed
`error.code: QF_SYNC_RESPONSE_TOO_LARGE` envelope. Only GET with this status and
validated envelope is interpreted as a provider size hint; generic 5xx,
`QF_SYNC_INVALID_RESPONSE`, invalid JSON and malformed mutation data are not.
The optional human-readable error message is never exposed. Error envelopes are
read with the same byte bound and deadline; unreadable error bodies keep their
HTTP error classification. Locally oversized successful responses also trigger
bounded page reduction. Halve the requested limit (1000 down to 1) and restart
OFFSET traversal from the stored head. Never continue the old page number with
a new limit. Previously applied supported effects are idempotent, and no failed
traversal commits its cursor. Each traversal retains the 1000-page guard and
bounded stable-head restarts. A single oversized mutation still fails closed.

An oversized push receipt is an uncertain outcome, not evidence that the write
failed. POST error bodies are not interpreted as pull size hints. Preserve
immutable in-flight evidence and use stable-pull recovery;
never blindly resend a NOTE CREATE. An uncorrelated ambiguous NOTE CREATE still
needs an authoritative receipt lookup or an explicit user-resolution policy.
This remains unresolved and tracked by [Bayaan issue #323](https://github.com/thebayaan/Bayaan/issues/323).
That open recovery decision is separate from valid unsupported bookmark data.

A durable BOOKMARK or NOTE DELETE owns its account-local remote identity even
after the visible row is removed. Pull CREATE/UPDATE effects check the durable
DELETE in the same page transaction before inserting an absent row, regardless
of pending, in-flight or ambiguous delivery. A deferred push or permanent 403
must not resurrect the bookmark or discard the delete identity/payload. A pull
or unobserved DELETE tombstone is not an ACK receipt; pending work is retained.
The stable pull head can still advance over these suppressed local effects. Explicit Retry clears the lifecycle's permanent-error
barrier; ordinary local-edit triggers do not create a permanent-error retry loop.
