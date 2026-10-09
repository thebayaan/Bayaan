# QF settings synchronization (pre-live)

Bayaan keeps Zustand persistence as the UI source of truth. When the existing
QF sync flag is enabled and a user is authenticated, a separate settings
lifecycle reconciles those local values through the Bayaan backend; the mobile
app never receives Quran Foundation credentials or access/refresh tokens.

The backend runbook
`docs/testing/qf-prelive-settings-sync.md` in `bayaan-backend` defines the
required pre-live OAuth grants and App State admin policy. This integration is
not approved for production launch.

## Local architecture

- `qfSettingsSnapshot.ts` is the explicit preference allowlist. Adding a field
  to a persisted store does not upload it automatically; reviewers must classify
  it as a preference or excluded local/runtime state.
- `qfSettingsStoreBridge.ts` waits for Zustand hydration, observes the approved
  stores, captures documents, and applies validated remote fields.
- `qfSettingsStorage.ts` persists reconciliation metadata per Bayaan account.
- `qfSettingsSyncCoordinator.ts` persists raw server values, their ETags, and
  the corresponding known-field device projection per account. It records
  local leaf-level changes before building a complete PUT, preserves exact
  bytes/idempotency keys on ambiguous retries, and rebases HTTP 412 responses.
- `qfSettingsMerge.ts` applies only changed local leaves to raw server values.
  Nested maps merge recursively (including explicit leaf removals); arrays are
  atomic. Unknown fields are retained, not applied to the UI.
- `qfSettingsSyncLifecycle.ts` follows authentication, network, and foreground
  state and retries transient failures with bounded backoff.
- `bayaanSettingsApiClient.ts` talks only to the narrow Bayaan BFF routes using
  the opaque Bayaan session.

## Dedicated Preferences versus App State

QF Preferences are used only for Quran/translation font scales, Tajweed
visibility, selected tafsir, and Mushaf playback rate. Global theme mode and
the selected Bayaan translation remain in App State: QF's `sepia` theme and QF
translation resource IDs cannot be mapped losslessly to Bayaan's theme modes,
bundled translation slugs, and AlQuran Cloud edition identifiers.

Preferences uploads contain only changed group/key intent compared with the
acknowledged device projection, not all five historical device values. Persist
the submitted delta before sending; if delivery is partial or uncertain, retry
the **whole submitted batch**, keeping its keys/values unchanged. Newer edits
remain separate and acknowledgment advances only submitted keys. The provider's
whole-batch last-write-wins retry policy and backoff are unchanged. Healthy
remote siblings still apply while another key is pending. Raw opaque values
remain in the baseline, never uploaded as fallback values. The BFF must retain
opaque JSON for the five allowlisted known preference keys on GET (while still
dropping unknown keys/groups and strictly validating POST); mobile cannot infer
unsupported values that the BFF omits. Local contract fixtures are not live
provider or two-device QA.

## Conflict policy

On an empty server, local values are uploaded. Before the first sync of a newly
encountered second account, Bayaan restores the device baseline captured before
any account settings were applied; this prevents values left in shared Zustand
stores by another account from being copied silently. When first login or
first reconciliation finds conflicting device/account settings, the user chooses
“Use cloud settings” or “Keep this device.” The cloud choice retains local
values where the server has none; the device choice applies the device's known
fields over the raw server document. Unknown remote fields survive both choices.
Returning to an initialized account restores its account-local snapshot when
another account owned the shared stores. A mismatch on the same account (such
as an app update or a missed debounce) is a normal local edit, not a prompt.
An account change or sign-out cancels a pending first-reconciliation choice so
shutdown never waits for the alert.
A present remote value unsupported by this device (for example a future reading
theme ID or a taxonomy-only rewayah without bundled text) is not an absent field: the device fallback becomes its synchronized
projection, while the raw value survives until an actual local edit. This also
applies to the explicit cloud choice during legacy reconciliation.
Subsequent writes change only fields edited locally since the last synchronized
projection. Complete PUT bodies overlay that local intent onto the raw
last-synced document, preserving unknown fields and unrelated known fields.
On HTTP 412, fetch both the fresh value and ETag, apply only the pending local
leaf changes, persist a new body/idempotency key, and retry with that ETag.
For example, if offline device B changes `showWBW` while device A changes
`pageLayout`, B's retry keeps A's `pageLayout`. Same-leaf conflicts retain B's
explicit local intent; a later pull converges the local stores to the merged
server document.

Edits during requests remain a separate durable mutation: acknowledged values
are applied locally with only newer local edits overlaid. Ambiguous deliveries
must finish their exact-byte replay before that newer intent is sent. Pulls
capture in-flight edits and merge them onto fetched values before applying UI
state. Capture runs again synchronously after the final persistence await,
with no await before application, so edits during storage I/O are not lost.
Pulls and acknowledgments replace understood maps, including empty maps, rather
than additively retaining remotely removed siblings; unsupported fields keep
their device fallback and unknown fields remain only in the raw baseline.
Account/generation guards prevent stale operations applying another
account's values.

Legacy records without raw Preferences and acknowledged projection evidence
cannot prove that a full preference snapshot is per-key intent. Preserve the
account-local snapshot and pending/submitted preference evidence behind a
persisted reconciliation barrier; a fingerprint alone does not prove provenance.
A complete read and the existing explicit cloud/device choice are required
before new delivery. Failed reads and offline restarts retain the barrier.
The decision may replace legacy unsubmitted intent, but never discards an
immutable submitted retry batch. The selected known fields are merged onto
freshly fetched raw documents; unknown remote fields survive both choices.
No account metadata is shared with another account.

The BFF enforces exact write allowlists; its allowlist must ship before any app
version adds a setting. Reads tolerate and omit unsupported/invalid fields while
retaining the ETag. Mobile does not trim approved captured data to hide a 400.
If the server advertises a future positive `schemaVersion` with `readOnly: true`,
mobile may project supported fields for display, but persists a per-key write
barrier and retains local leaf intent without uploading a v1 downgrade. A 412
that discovers such a document also installs the barrier before retry. Other
settings documents continue to sync normally. Malformed documents still fail
closed, and ambiguous writes retain their byte/idempotency recovery contract.
For initialized accounts, reads settle independently: healthy documents are
applied and persisted even when a sibling document or Preferences fetch fails.
A failed read is never treated as absence and cannot erase its raw baseline,
ETag, write barrier or pending intent. The failure still reaches the lifecycle
for bounded retry, without reporting success. A 401 remains account-wide and
prevents any remote application. Initial reconciliation requires a complete
read before establishing baselines, choosing a conflict policy or uploading.

Capture is drained synchronously before account ownership changes. Explicit
in-app sign-out drains pending capture, removes only that account's persisted
settings metadata, and records the visible known-field snapshot as a signed-out
comparison point. Later deliberate guest edits update the neutral baseline;
unchanged prior-account settings are not silently copied into a new account.

## Explicit exclusions

Do not add downloads, queues, playback position, recent reading/search/play
history, sleep timers, onboarding counters, developer controls, analytics
identifiers or consent, cache metadata, derived theme objects, transient UI
state, or runtime errors. Analytics consent stays device-local so a new
device's default cannot override an opt-out made elsewhere. The deprecated
primary/accent color and the unreleased community-reflections toggle are also
excluded. Bookmark/note/reading progress and content collections use
other ownership/synchronization contracts and do not belong in settings App
State.
