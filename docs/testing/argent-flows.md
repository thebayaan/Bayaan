# Argent regression flows

Device checks for the Quran.Foundation integration (see the QF regression testing strategy, Layer 5). Flows live in `.argent/flows/` and replay with Argent's `flow-execute` against a booted iOS simulator.

## Building the apps for the simulator

Local builds on Xcode 27 need three workarounds (CI and cloud builds may not):

1. Patch `node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift` (~line 242): Swift 6.3 rejects `set == nil ? nil : setter`. Replace the ternary with an `if`/`else` that builds `expo.HostObjectCallbacks` with `nil` or `setter`. `npm install` wipes this.
2. Pass `IPHONEOS_DEPLOYMENT_TARGET=16.4` (Xcode 27 rejects pods targeting below iOS 15).
3. Sign ad hoc. `CODE_SIGNING_ALLOWED=NO` strips the App Group entitlement, and the app then throws at startup (`MMKVPlatformContext.getAppGroupDirectory(...): Container for AppGroup "group.com.bayaan.app" not accessible`). Re-signing the built app with `codesign` does not fix it; the simulator rejects the launch.

```bash
cd ios && pod install && cd ..
xcodebuild -workspace ios/Bayaan.xcworkspace -scheme Bayaan -configuration Release \
  -sdk iphonesimulator -destination 'id=<udid>' -derivedDataPath ios/build/dd \
  IPHONEOS_DEPLOYMENT_TARGET=16.4 CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= build
xcrun simctl install <udid> ios/build/dd/Build/Products/Release-iphonesimulator/Bayaan.app
```

Release builds bundle their JS, so no Metro is needed. For an old release, check out the tag in its own worktree (`git worktree add --detach ../bayaan-v2.3.0 v2.3.0`). The tag's `Info.plist` may report an older marketing version; the code is still the tag's.

`pod install` rewrites `ios/Podfile.lock` and `ios/ShareExtension/PrivacyInfo.xcprivacy`; do not commit those changes from a test build.

## Real-device schema check (2026-10-07)

Simulator: iPhone 17 Pro (test), iOS 26.

| Step | Result |
|---|---|
| Existing `v2.2.1` install, schemas vs `test-fixtures/golden/v2.2.1` | playlists, tafaseer, translations identical. `verse-annotations.db` had an extra empty `notes_new` table (see below) |
| Install `v2.3.0` over it; add bookmark 1:2, green highlight 1:3, note on 1:5 by hand | Launches; Continue Listening history kept |
| `v2.3.0` schemas vs regenerated `test-fixtures/golden/v2.3.0` | All four databases identical, including `notes_new` |
| Rows | bookmark, highlight and note saved with `rewayah_id = hafs` |
| Install `develop` over it | Launches; bookmark, highlight, note and 6231 tafsir rows kept; schemas unchanged |

**`notes_new` on real devices.** `VerseAnnotationDatabaseService` checks for `sqlite_autoindex_notes_1` to detect an old UNIQUE constraint, but that index belongs to `id TEXT PRIMARY KEY`, so the rebuild branch runs on every launch. Once `verse_keys` and `rewayah_id` were added, `INSERT OR IGNORE INTO notes_new SELECT * FROM notes` fails (10 columns into 7) and the error is swallowed, leaving an empty 7-column `notes_new`. Every device that has launched more than once carries it. Today it is harmless. A future migration must not reuse the name `notes_new` with `CREATE TABLE IF NOT EXISTS`, or it will silently get the stale 7-column table. The golden generator now simulates a second launch so goldens match real devices.

## Flows

### `core-smoke`

Prerequisite: the app was last left on the Al-Fatihah mushaf page (the app reopens where it was left). The flow returns to that page at the end, so replays are repeatable.

1. Relaunch; wait for the mushaf (`Juz 1`).
2. Long-press 1:2, open Tafseer, wait for `IBN KATHIR`, dismiss.
3. Play: open playback settings, pick the first reciter, play, stop.
4. Turn the page (horizontal swipe), wait for `Al-Baqarah`, swipe back.

Replay: `flow-execute` with `name: core-smoke`, `project_root: <repo root>`, `device: <udid>`. Baseline on `develop` (2026-10-07): 22 of 22 steps pass in 31 s.

Steps 6, 12, 14 and 16 are coordinate taps (the sheets have no accessible labels); a layout change in those sheets needs a re-record.

### Upgrade (manual for now)

1. Install the `v2.3.0` build; create a bookmark, a highlight and a note.
2. Copy `Documents/SQLite/*.db*` out of `xcrun simctl get_app_container <udid> com.bayaan.app data`.
3. Install the candidate build over it, launch, copy the databases again.
4. Compare row contents and `sqlite_master` table and column sets between the two copies.

## Not yet covered

- Adhkar counter and playlist flows.
- Android emulator runs (the debug APK builds; see `.github/workflows/native-build.yml`).
- Flows 1 to 6 of the strategy (fresh install, offline, kill mid-update, withdrawal, QF sign-in) depend on the mobile content-sync work and #320, and get recorded with those changes.
