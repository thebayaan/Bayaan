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
- `qfSettingsSyncCoordinator.ts` records complete-replacement intent before
  network delivery, preserves exact request bytes/idempotency keys on ambiguous
  retries, rebases HTTP 412 responses, and isolates account snapshots.
- `qfSettingsSyncLifecycle.ts` follows authentication, network, and foreground
  state and retries transient failures with bounded backoff.
- `bayaanSettingsApiClient.ts` talks only to the narrow Bayaan BFF routes using
  the opaque Bayaan session.

## Conflict policy

On an empty server, local values are uploaded. When first login or account
activation finds conflicting device/account settings, the user chooses “Use
cloud settings” or “Keep this device.” Server fields are retained where they
exist and local fields are retained where the server has no value. Subsequent
ETag conflicts preserve the newest local complete-document replacement.

## Explicit exclusions

Do not add downloads, queues, playback position, recent reading/search/play
history, sleep timers, onboarding counters, developer controls, analytics
identifiers, cache metadata, derived theme objects, transient UI state, or
runtime errors. Bookmark/note/reading progress and content collections use
other ownership/synchronization contracts and do not belong in settings App
State.
