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

**`notes_new` on real devices (fixed).** `VerseAnnotationDatabaseService` used to check for `sqlite_autoindex_notes_1` to detect an old UNIQUE constraint, but that index belongs to `id TEXT PRIMARY KEY`, so the rebuild branch ran on every launch and, once `verse_keys` and `rewayah_id` existed, failed silently and left an empty 7-column `notes_new` on every device that launched more than once. The migration now rebuilds only for a real UNIQUE constraint (`index_list` origin `u`), copies an explicit column list inside a transaction, and drops the empty orphan on launch (a non-empty `notes_new` is left in place with a warning). The golden generator still simulates a second launch, so the goldens keep the orphan and the upgrade test asserts develop removes it.

## Flows

### `core-smoke`

Prerequisite: the app was last left on the Al-Fatihah mushaf page (the app reopens where it was left). The flow returns to that page at the end, so replays are repeatable.

The YAML has 25 entries (two of them `echo` notes). Numbered as in the flow report:

1. `launch` the app.
2. `screenshot`.
3. `await-ui-element` `Juz 1` (mushaf visible).
4. `echo`: prerequisite note.
5. `gesture-custom` long-press on 1:2 (coordinates).
6. `tap` Tafseer in the verse sheet (coordinates).
7. `screenshot`.
8. `await-ui-element` `IBN KATHIR` (sheet header).
9. `await-ui-element` `The Meaning of Al-Hamd` (a heading in the bundled Ibn Kathir text for 1:2, so an empty or "not available" sheet fails). Replayed 2026-10-07: full flow 23 of 23 steps pass in 33 s; replace the substring when the content-sync work changes the tafsir source.
10. `gesture-swipe` down to dismiss the sheet.
11. `gesture-tap` the playback settings button at the bottom (coordinates, y 0.94).
12. `screenshot`.
13. `tap` the reciter row (coordinates).
14. `screenshot`.
15. `tap` the first reciter (coordinates).
16. `screenshot`.
17. `tap` play (coordinates).
18. `screenshot`.
19. `tap` `stop.fill` (accessibility id).
20. `gesture-swipe` to the next page.
21. `screenshot`.
22. `await-ui-element` `Al-Baqarah`.
23. `echo`: return note.
24. `gesture-swipe` back to page 1.
25. `await-ui-element` `Al-Fatihah`.

Replay: `flow-execute` with `name: core-smoke`, `project_root: <repo root>`, `device: <udid>`. Baseline on `develop` (2026-10-07), before step 9 was added: all 24 entries pass in 31 s (the report counted 22 steps).

Steps 5, 6, 11, 13, 15 and 17 use coordinates (the sheets have no accessible labels); a layout change in those sheets needs a re-record.

### Upgrade (manual for now)

1. Install the `v2.3.0` build; create a bookmark, a highlight and a note.
2. Copy `Documents/SQLite/*.db*` out of `xcrun simctl get_app_container <udid> com.bayaan.app data`.
3. Install the candidate build over it, launch, copy the databases again.
4. Compare row contents and `sqlite_master` table and column sets between the two copies.

## Not yet covered

- Adhkar counter and playlist flows.
- Android emulator runs (the debug APK builds; see `.github/workflows/native-build.yml`).
- Flows 1 to 6 of the strategy (fresh install, offline, kill mid-update, withdrawal, QF sign-in) depend on the mobile content-sync work and #320, and get recorded with those changes.
