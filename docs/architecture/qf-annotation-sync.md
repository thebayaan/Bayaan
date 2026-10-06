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

## Bookmark projection and cursor meaning

QF supports `page`, `juz`, `surah`, and `ayah` bookmarks. Non-ayah bookmarks may
have no `verseNumber` or a null value. Bayaan currently represents only ayah
bookmarks. The official [bookmark schema](https://api-docs.quran.com/docs/user_related_apis_prelive/get-bookmark/)
and [Get mutations contract](https://api-docs.quran.com/docs/user_related_apis_prelive/get-mutations/)
document this distinction; Get mutations filters resources, not bookmark types.

On pull, the codec validates the envelope, identity, timestamp, and allowlisted
bookmark data before projecting out recognized non-ayah CREATE/UPDATE effects.
It does not reinterpret a page number as an ayah, delete a local row merely
because its remote update is unsupported, enqueue a cloud write, or change the
provider bookmark. Unknown types, conflicting type aliases, malformed ayah
bookmarks, and malformed NOTE data still fail closed.

DELETE tombstones carry no bookmark type or verse coordinates. Keep them in the
projection and apply them only to matching account-local remote IDs, subject to
existing stale-timestamp and pending-intent guards. Unobserved IDs have no local
effect; they are not inferred to be ayah bookmarks.

Provider `page`, `limit`, `total`, and `hasMore` describe the unprojected stream.
They are never recomputed from the local effect count. An empty projected page
can have a continuation. Without explicit pagination, the received raw count
still prevents a full unsupported-only page from appearing to be a terminal
short page. Traverse every page, then recheck the provider metadata head before
committing the account cursor. A committed cursor means this supported local
projection is caught up, not that every provider resource has a local model.

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
That open recovery decision is separate from valid unsupported bookmark data.

A durable NOTE DELETE owns its account-local remote identity even after the
visible row is removed. Pull updates cannot reinsert that note before the delete
is delivered or reconciled. Explicit Retry clears the lifecycle's permanent-error
barrier; ordinary local-edit triggers do not create a permanent-error retry loop.
