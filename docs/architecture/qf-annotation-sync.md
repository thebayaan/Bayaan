# QF annotation synchronization (pre-live)

The mobile client uses only the Bayaan BFF with an opaque, device-bound session.
SQLite rows, outbox entries, and stable pull heads belong to a single account.
This integration remains off by default; local fixture validation does not
replace native iOS/Android or two-device provider QA.

## Signed-out device storage

Current behavior retains account-scoped SQLite annotations and their durable
outbox on explicit sign-out. Guest scope does not expose or upload those rows;
only returning to the same account resumes them. This is not a device-data purge.
The shared-device retention/purge policy still needs a product decision before
launch; no destructive cleanup is inferred from signing out.

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
bookmark data before projecting out recognized non-ayah CREATE/UPDATE effects.
It also excludes CREATE/UPDATE reads explicitly marked
`isInDefaultCollection: true`. These are known Favorites memberships, not
standalone bookmarks that Bayaan can safely delete. The official
[Delete Bookmark contract](https://api-docs.quran.com/docs/user_related_apis_prelive/delete-bookmark/)
states that deleting a collection-backed bookmark only sets `isReading` to
`false`, leaving Favorites and custom collection membership intact.
[Delete collection bookmark by id](https://api-docs.quran.com/docs/user_related_apis_prelive/delete-collection-bookmark-by-id/)
requires both `collectionId` and `bookmarkId`; Favorites use `__default__`.
The [Sync local mutations contract](https://api-docs.quran.com/docs/user_related_apis_prelive/sync-local-mutations/)
distinguishes `BOOKMARK` identity from the composite `COLLECTION_BOOKMARK`
identity. A bookmark ID must not be reinterpreted as a collection membership ID.
Push receipts are not filtered, and this boundary does not enable collection
writes or claim that a standalone DELETE removes Favorites.

**Remaining saved-state and custom-collection limit:** existing bookmark rows
store remote IDs and verse coordinates, but no membership metadata. Previously
projected Favorites cannot be identified safely from persisted rows/outbox alone.
An excluded update leaves those rows and all pending work unchanged; it is not a
migration or full remediation of their deletion semantics. Custom memberships
are separate `COLLECTION_BOOKMARK` resources, which the current mobile resource
filter does not request. `bookmarkGroup` (for example `verses_6236`) is not proof
of a collection ID; `isInDefaultCollection: false` or an absent flag does not
prove absence of custom membership. This narrow projection therefore excludes
only known Favorites, not all collection-backed bookmarks. Before claiming full
collection-backed deletion support, a separate approved design must address
membership discovery, existing saved rows and queued operations, and a safe
migration/user-resolution policy (or implement collection resources). Do not
purge rows, discard pending operations, replay deletes against guessed IDs, or
quietly declare Favorites removed. No such migration or collection support is
included here.

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
